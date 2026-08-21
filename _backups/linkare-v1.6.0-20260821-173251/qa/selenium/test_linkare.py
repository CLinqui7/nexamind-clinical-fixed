import os
import time
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get('LINKARE_BASE_URL', 'http://127.0.0.1:4173')

class LinkareSeleniumQA(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        options = webdriver.ChromeOptions()
        if os.environ.get('HEADED', '0') != '1':
            options.add_argument('--headless=new')
        options.add_argument('--disable-gpu')
        options.add_argument('--no-sandbox')
        options.add_argument('--window-size=1440,1000')
        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 15)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def reset(self):
        self.driver.set_window_size(1440, 1000)
        self.driver.get(BASE_URL)
        self.driver.execute_script("localStorage.clear(); sessionStorage.clear();")
        self.driver.refresh()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.login-shell')))

    def login_doctor(self):
        self.driver.find_element(By.XPATH, "//button[.//b[contains(.,'Cuenta médica')]]").click()
        self.driver.find_element(By.CSS_SELECTOR, 'form.login-form button[type="submit"]').click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.topbar')))

    def start_quick_tour(self):
        self.driver.find_element(By.CSS_SELECTOR, '.help-button').click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.help-content')))
        buttons = self.driver.find_elements(By.XPATH, "//button[contains(.,'Esencial')]")
        self.assertTrue(buttons)
        self.driver.execute_script('arguments[0].click()', buttons[0])
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.compact-card')))

    def test_01_login_and_compact_tutorial(self):
        self.reset(); self.login_doctor(); self.start_quick_tour()
        for _ in range(4):
            card = self.driver.find_element(By.CSS_SELECTOR, '.compact-card')
            rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight};", card)
            self.assertGreaterEqual(rect['l'], -1)
            self.assertLessEqual(rect['r'], rect['w'] + 1)
            self.assertGreaterEqual(rect['t'], -1)
            self.assertLessEqual(rect['b'], rect['h'] + 1)
            next_button = card.find_element(By.XPATH, ".//button[contains(.,'Siguiente') or contains(.,'Finalizar')]")
            self.driver.execute_script('arguments[0].click()', next_button)
            time.sleep(.25)

    def test_02_payments_screen_and_settings(self):
        self.reset(); self.login_doctor()
        self.driver.find_element(By.XPATH, "//nav//button[.//span[normalize-space()='Cobros']]").click()
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, 'h1'), 'Wompi, tarifas y pagos'))
        self.driver.find_element(By.XPATH, "//button[contains(.,'Configurar pagos')]").click()
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, '.modal h2'), 'Métodos de pago'))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//label[contains(.,'Checkout URL')]"))

    def test_03_mobile_tutorial_stays_inside_viewport(self):
        self.reset(); self.login_doctor()
        self.driver.set_window_size(375, 667)
        self.driver.execute_script("document.querySelector('.help-button')?.click()")
        time.sleep(.3)
        buttons = self.driver.find_elements(By.XPATH, "//button[contains(.,'Esencial')]")
        self.assertTrue(buttons)
        self.driver.execute_script('arguments[0].click()', buttons[0])
        card = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.compact-card')))
        rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight};", card)
        self.assertGreaterEqual(rect['l'], -1)
        self.assertLessEqual(rect['r'], rect['w'] + 1)
        self.assertLessEqual(rect['b'], rect['h'] + 1)

    def test_04_secretary_restrictions(self):
        self.reset()
        self.driver.find_element(By.XPATH, "//button[.//b[contains(.,'Cuenta de secretaría')]]").click()
        self.driver.find_element(By.CSS_SELECTOR, 'form.login-form button[type="submit"]').click()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.secretary-view')))
        labels = [e.text.strip() for e in self.driver.find_elements(By.CSS_SELECTOR, 'nav.nav-pill button span')]
        self.assertNotIn('Resultados', labels)
        self.assertNotIn('Alertas', labels)

if __name__ == '__main__':
    unittest.main(verbosity=2)
