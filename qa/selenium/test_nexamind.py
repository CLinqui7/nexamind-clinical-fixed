from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import unittest
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("NEXAMIND_QA_URL", "http://127.0.0.1:4173")
HEADED = os.getenv("NEXAMIND_QA_HEADED", "0") == "1"


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str = ""


class NexaMindSeleniumQA(unittest.TestCase):
    server: subprocess.Popen[str] | None = None
    driver: webdriver.Chrome
    wait: WebDriverWait
    results: list[CheckResult] = []

    @classmethod
    def setUpClass(cls) -> None:
        cls._ensure_server()
        options = Options()
        if not HEADED:
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1600,1000")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--force-device-scale-factor=1")
        options.add_argument("--lang=es")
        chrome_binary = os.getenv("CHROME_BINARY")
        if chrome_binary:
            options.binary_location = chrome_binary
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 15)

    @classmethod
    def tearDownClass(cls) -> None:
        try:
            cls.driver.quit()
        finally:
            if cls.server and cls.server.poll() is None:
                cls.server.terminate()
                try:
                    cls.server.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    cls.server.kill()
        report = {
            "baseUrl": BASE_URL,
            "checks": [asdict(item) for item in cls.results],
            "passed": sum(item.status == "PASS" for item in cls.results),
            "failed": sum(item.status == "FAIL" for item in cls.results),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        (ARTIFACTS / "selenium-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    @classmethod
    def _ensure_server(cls) -> None:
        try:
            with urlopen(BASE_URL, timeout=2) as response:
                if response.status < 500:
                    return
        except Exception:
            pass
        npm = "npm.cmd" if os.name == "nt" else "npm"
        cls.server = subprocess.Popen(
            [npm, "run", "dev", "--", "--host", "127.0.0.1"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 30
        while time.time() < deadline:
            try:
                with urlopen(BASE_URL, timeout=2) as response:
                    if response.status < 500:
                        return
            except Exception:
                time.sleep(0.5)
        output = ""
        if cls.server.stdout:
            try:
                output = cls.server.stdout.read()
            except Exception:
                output = ""
        raise RuntimeError(f"Vite no inició en {BASE_URL}. Salida:\n{output}")

    def record(self, name: str, fn) -> None:
        try:
            fn()
            self.results.append(CheckResult(name, "PASS"))
        except Exception as exc:
            self.results.append(CheckResult(name, "FAIL", str(exc)))
            self.driver.save_screenshot(str(ARTIFACTS / f"FAIL-{self._slug(name)}.png"))
            raise

    @staticmethod
    def _slug(value: str) -> str:
        return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")

    def open_clean(self, width: int = 1600, height: int = 1000) -> None:
        self.driver.set_window_size(width, height)
        self.driver.get(BASE_URL)
        self.driver.execute_script("localStorage.clear(); sessionStorage.clear();")
        self.driver.refresh()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".login-shell")))

    def login(self, email: str, password: str) -> None:
        email_input = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '.login-form input[type="email"]')))
        password_input = self.driver.find_element(By.CSS_SELECTOR, '.login-form input[type="password"], .login-form input[type="text"]')
        email_input.clear()
        email_input.send_keys(email)
        password_input.clear()
        password_input.send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, ".login-submit").click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".app-frame")))

    def click_button_text(self, text: str) -> None:
        xpath = f"//button[normalize-space(.)='{text}' or .//*[normalize-space(text())='{text}']]"
        button = self.wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
        self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", button)
        button.click()

    def current_step_id(self) -> str:
        return self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".guided-tour"))).get_attribute("data-tour-step-id")

    def advance_until(self, step_id: str, max_steps: int = 120) -> None:
        for _ in range(max_steps):
            current = self.current_step_id()
            if current == step_id:
                return
            buttons = self.driver.find_elements(By.XPATH, "//aside[@data-tour-card='true']//button[.//span[normalize-space()='Siguiente'] or normalize-space()='Siguiente']")
            if not buttons:
                raise AssertionError(f"No se encontró Siguiente en el paso {current}")
            self.driver.execute_script("arguments[0].click();", buttons[0])
            self.wait.until(lambda d: d.find_element(By.CSS_SELECTOR, ".guided-tour").get_attribute("data-tour-step-id") != current)
        raise AssertionError(f"No se alcanzó el paso {step_id}")


    def perform_guided_action(self, step_id: str) -> None:
        actions = {
            "action-open-patients": lambda: self.driver.find_element(By.XPATH, "//nav[@data-tour='main-navigation']//button[.//span[normalize-space()='Pacientes']]").click(),
            "action-open-new-patient": lambda: self.click_button_text("Nuevo paciente"),
            "action-enable-insurance": lambda: self.driver.find_element(By.CSS_SELECTOR, '[data-tour="patient-form-insurance-toggle"]').click(),
            "action-open-patient-record": lambda: self.driver.find_element(By.CSS_SELECTOR, '[data-tour="patient-card"]').click(),
        }
        action = actions.get(step_id)
        if not action:
            raise AssertionError(f"No hay acción Selenium definida para {step_id}")
        action()
        self.wait.until(lambda d: "done" in d.find_element(By.CSS_SELECTOR, ".tour-action-box").get_attribute("class"))

    def advance_guided_until(self, step_id: str, max_steps: int = 130) -> None:
        for _ in range(max_steps):
            current = self.current_step_id()
            if current == step_id:
                return
            if current.startswith("action-"):
                self.perform_guided_action(current)
            buttons = self.driver.find_elements(By.XPATH, "//aside[@data-tour-card='true']//button[.//span[normalize-space()='Siguiente'] or normalize-space()='Siguiente']")
            if not buttons:
                raise AssertionError(f"No se encontró Siguiente en el paso {current}")
            buttons[0].click()
            self.wait.until(lambda d: d.find_element(By.CSS_SELECTOR, ".guided-tour").get_attribute("data-tour-step-id") != current)
        raise AssertionError(f"No se alcanzó el paso {step_id}")

    def assert_spotlight_aligned(self, target_selector: str, tolerance: float = 18) -> None:
        target = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, target_selector)))
        spotlight = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-tour-spotlight="true"]')))
        card = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-tour-card="true"]')))
        target_rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};", target)
        spot_rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};", spotlight)
        card_rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};", card)
        self.assertLessEqual(abs(spot_rect["x"] - target_rect["x"]), tolerance)
        self.assertLessEqual(abs(spot_rect["y"] - target_rect["y"]), tolerance)
        self.assertGreaterEqual(spot_rect["w"], min(24, target_rect["w"]))
        overlap_x = max(0, min(card_rect["right"], target_rect["right"]) - max(card_rect["x"], target_rect["x"]))
        overlap_y = max(0, min(card_rect["bottom"], target_rect["bottom"]) - max(card_rect["y"], target_rect["y"]))
        self.assertLess(overlap_x * overlap_y, 16, f"La tarjeta del tutorial cubre el objetivo: {overlap_x}x{overlap_y}")

    def test_01_doctor_login_and_wrong_password(self) -> None:
        def run() -> None:
            self.open_clean()
            email = self.driver.find_element(By.CSS_SELECTOR, '.login-form input[type="email"]')
            password = self.driver.find_element(By.CSS_SELECTOR, '.login-form input[type="password"]')
            email.send_keys("doctora@nexamind.demo")
            password.send_keys("incorrecta")
            self.driver.find_element(By.CSS_SELECTOR, ".login-submit").click()
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".login-error")))
            password.clear()
            password.send_keys("NexaMind2026!")
            self.driver.find_element(By.CSS_SELECTOR, ".login-submit").click()
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".app-frame")))
        self.record("Login médico y rechazo de contraseña incorrecta", run)

    def test_02_tutorial_insurance_focus_and_guided_clicks(self) -> None:
        def run() -> None:
            # Restart tutorial v5 without deleting clinical demo data.
            self.driver.execute_script("localStorage.removeItem('nexamind-clinical-tutorial-v6'); location.reload();")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".tutorial-intro-card")))
            self.click_button_text("Recorrido completo")
            self.advance_until("action-open-patients")
            next_button = self.driver.find_element(By.XPATH, "//aside[@data-tour-card='true']//button[.//span[contains(.,'Complete la acción')]]")
            self.assertTrue(next_button.get_attribute("disabled") is not None)
            nav_patient = self.wait.until(EC.element_to_be_clickable((By.XPATH, "//nav[@data-tour='main-navigation']//button[.//span[normalize-space()='Pacientes']]")))
            nav_patient.click()
            self.wait.until(lambda d: "done" in d.find_element(By.CSS_SELECTOR, ".tour-action-box").get_attribute("class"))
            self.click_button_text("Siguiente")
            self.advance_until("action-open-new-patient")
            self.click_button_text("Nuevo paciente")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".modal")))
            self.wait.until(lambda d: "done" in d.find_element(By.CSS_SELECTOR, ".tour-action-box").get_attribute("class"))
            self.click_button_text("Siguiente")
            self.advance_until("action-enable-insurance")
            self.assert_spotlight_aligned('[data-tour="patient-form-insurance-toggle"]')
            toggle = self.wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-tour="patient-form-insurance-toggle"]')))
            toggle.click()
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-tour="patient-form-insurance-details"]')))
            self.wait.until(lambda d: "done" in d.find_element(By.CSS_SELECTOR, ".tour-action-box").get_attribute("class"))
            self.click_button_text("Siguiente")
            self.wait.until(lambda d: d.find_element(By.CSS_SELECTOR, ".guided-tour").get_attribute("data-tour-step-id") == "patient-form-insurance-details")
            self.assert_spotlight_aligned('[data-tour="patient-form-insurance-details"]', tolerance=20)
            self.advance_guided_until("patient-form-save")
            self.assert_spotlight_aligned('[data-tour="patient-form-save"]', tolerance=22)
            self.driver.save_screenshot(str(ARTIFACTS / "tutorial-insurance-focus.png"))
        self.record("Tutorial guiado, seguro y spotlight exacto", run)

    def test_03_mobile_tutorial_has_no_blank_screen(self) -> None:
        def run() -> None:
            self.driver.set_window_size(375, 667)
            self.driver.execute_script("localStorage.removeItem('nexamind-clinical-tutorial-v6'); location.reload();")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".tutorial-intro-card")))
            self.click_button_text("Recorrido esencial")
            card = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-tour-card="true"]')))
            body_text = self.driver.find_element(By.TAG_NAME, "body").text.strip()
            self.assertGreater(len(body_text), 100)
            rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};", card)
            self.assertGreaterEqual(rect["x"], -2)
            self.assertLessEqual(rect["right"], 377)
            self.assertGreaterEqual(rect["y"], -2)
            self.assertLessEqual(rect["bottom"], 669)
            self.driver.save_screenshot(str(ARTIFACTS / "tutorial-mobile.png"))
        self.record("Tutorial móvil sin pantalla blanca", run)

    def test_04_patient_photo_target_and_draggable_help(self) -> None:
        def run() -> None:
            self.driver.set_window_size(1600, 1000)
            self.driver.execute_script("localStorage.removeItem('nexamind-clinical-tutorial-v6'); location.reload();")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".tutorial-intro-card")))
            self.click_button_text("Recorrido completo")
            self.advance_guided_until("patient-photo")
            self.assert_spotlight_aligned('[data-tour="patient-photo"]', tolerance=22)
            warnings = self.driver.find_elements(By.CSS_SELECTOR, ".tour-target-warning")
            self.assertEqual(len(warnings), 0, "El paso de fotografía no debe mostrar objetivo perdido")
            card = self.driver.find_element(By.CSS_SELECTOR, '[data-tour-card="true"]')
            handle = self.driver.find_element(By.CSS_SELECTOR, ".tour-drag-handle")
            before = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y};", card)
            ActionChains(self.driver).move_to_element(handle).click_and_hold().move_by_offset(-180, 90).release().perform()
            self.wait.until(lambda d: "tour-card-manual" in d.find_element(By.CSS_SELECTOR, '[data-tour-card="true"]').get_attribute("class"))
            after = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {x:r.x,y:r.y};", card)
            self.assertGreater(abs(after["x"] - before["x"]) + abs(after["y"] - before["y"]), 70)
            self.driver.find_element(By.CSS_SELECTOR, ".tour-auto-position").click()
            self.wait.until(lambda d: "tour-card-manual" not in d.find_element(By.CSS_SELECTOR, '[data-tour-card="true"]').get_attribute("class"))
            self.driver.save_screenshot(str(ARTIFACTS / "tutorial-photo-drag.png"))
        self.record("Fotografía localizada y panel de ayuda arrastrable", run)

    def test_05_secretary_login_and_restricted_view(self) -> None:
        def run() -> None:
            self.driver.set_window_size(1400, 900)
            self.driver.execute_script("localStorage.removeItem('nexamind-clinical-auth-v1'); location.reload();")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".login-shell")))
            self.login("secretaria@nexamind.demo", "Agenda2026!")
            self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".secretary-view")))
            nav_text = self.driver.find_element(By.CSS_SELECTOR, '[data-tour="main-navigation"]').text
            self.assertNotIn("Resultados", nav_text)
            self.assertNotIn("Alertas", nav_text)
            self.assertIn("Agenda", nav_text)
        self.record("Login de secretaría y vista restringida", run)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(NexaMindSeleniumQA)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
