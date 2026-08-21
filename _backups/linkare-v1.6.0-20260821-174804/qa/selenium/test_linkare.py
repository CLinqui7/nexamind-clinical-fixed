import os
import time
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

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
        self.driver.execute_script('localStorage.clear(); sessionStorage.clear();')
        self.driver.refresh()
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.login-shell')))

    def login_role(self, label):
        button = self.wait.until(EC.presence_of_element_located((By.XPATH, f"//button[.//b[contains(.,'{label}')]]")))
        self.driver.execute_script('arguments[0].click()', button)
        submit = self.driver.find_element(By.CSS_SELECTOR, 'form.login-form button[type="submit"]')
        self.driver.execute_script('arguments[0].click()', submit)
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.topbar')))
        self.dismiss_intro_if_present()

    def dismiss_intro_if_present(self):
        time.sleep(.8)
        close_buttons = self.driver.find_elements(By.CSS_SELECTOR, '.tutorial-intro-backdrop .tutorial-close')
        if close_buttons:
            self.driver.execute_script('arguments[0].click()', close_buttons[0])
            self.wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '.tutorial-intro-backdrop')))

    def start_quick_tour(self):
        self.driver.execute_script("document.querySelector('.help-button')?.click()")
        self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.help-content')))
        buttons = self.driver.find_elements(By.XPATH, "//button[contains(.,'Esencial')]")
        self.assertTrue(buttons)
        self.driver.execute_script('arguments[0].click()', buttons[0])
        return self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.visible-background-tour .compact-card')))

    def assert_card_inside_viewport(self, card):
        rect = self.driver.execute_script(
            "const r=arguments[0].getBoundingClientRect(); return {l:r.left,r:r.right,t:r.top,b:r.bottom,w:innerWidth,h:innerHeight};",
            card,
        )
        self.assertGreaterEqual(rect['l'], -1)
        self.assertLessEqual(rect['r'], rect['w'] + 1)
        self.assertGreaterEqual(rect['t'], -1)
        self.assertLessEqual(rect['b'], rect['h'] + 1)

    def test_01_tutorial_keeps_background_visible(self):
        self.reset(); self.login_role('Cuenta médica')
        card = self.start_quick_tour()
        self.assert_card_inside_viewport(card)
        self.assertFalse(self.driver.find_elements(By.CSS_SELECTOR, '.visible-background-tour .compact-dim'))
        app_frame = self.driver.find_element(By.CSS_SELECTOR, '.app-frame')
        values = self.driver.execute_script("const s=getComputedStyle(arguments[0]); return {opacity:s.opacity,filter:s.filter};", app_frame)
        self.assertEqual(values['opacity'], '1')
        self.assertIn(values['filter'], ('none', ''))

    def test_02_owner_edits_subscription_price(self):
        self.reset(); self.login_role('Administración Linkare')
        plan_nav = self.wait.until(EC.presence_of_element_located((By.XPATH, "//nav//button[.//span[normalize-space()='Mi plan']]")))
        self.driver.execute_script('arguments[0].click()', plan_nav)
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, 'h1'), 'Mi plan Linkare'))
        edit = self.driver.find_element(By.XPATH, "//button[contains(.,'Editar precio')]")
        self.driver.execute_script('arguments[0].click()', edit)
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, '.modal h2'), 'Precio y plan de Linkare'))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//label[contains(.,'Precio')]") or self.driver.find_elements(By.CSS_SELECTOR, 'input[type="number"]'))

    def test_03_owner_can_open_wompi_link_form(self):
        self.reset(); self.login_role('Administración Linkare')
        self.driver.execute_script("[...document.querySelectorAll('nav button')].find(b=>b.innerText.includes('Mi plan'))?.click()")
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, 'h1'), 'Mi plan Linkare'))
        buttons = self.driver.find_elements(By.XPATH, "//button[contains(.,'Generar enlace Wompi')]")
        self.assertTrue(buttons)
        # The button can be disabled until Supabase variables are configured, which is expected.
        if buttons[0].is_enabled():
            self.driver.execute_script('arguments[0].click()', buttons[0])
            self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, '.modal h2'), 'Generar enlace de pago Linkare'))
            self.assertTrue(self.driver.find_elements(By.XPATH, "//label[contains(.,'Monto a cobrar')]") or self.driver.find_elements(By.CSS_SELECTOR, 'input[type="number"]'))

    def test_04_doctor_sees_payment_not_admin_price_controls(self):
        self.reset(); self.login_role('Cuenta médica')
        self.driver.execute_script("[...document.querySelectorAll('nav button')].find(b=>b.innerText.includes('Mi plan'))?.click()")
        self.wait.until(EC.text_to_be_present_in_element((By.CSS_SELECTOR, 'h1'), 'Mi plan Linkare'))
        self.assertFalse(self.driver.find_elements(By.XPATH, "//button[contains(.,'Editar precio')]"))
        self.assertTrue(self.driver.find_elements(By.XPATH, "//*[contains(.,'Plan actual')]"))

    def test_05_mobile_tutorial_is_small_and_visible(self):
        self.reset(); self.login_role('Cuenta médica')
        self.driver.set_window_size(375, 667)
        card = self.start_quick_tour()
        self.assert_card_inside_viewport(card)
        rect = self.driver.execute_script("const r=arguments[0].getBoundingClientRect(); return {height:r.height,viewport:innerHeight};", card)
        self.assertLessEqual(rect['height'], rect['viewport'] * .48 + 5)

    def test_06_secretary_does_not_see_subscription(self):
        self.reset(); self.login_role('Cuenta de secretaría')
        labels = [element.text.strip() for element in self.driver.find_elements(By.CSS_SELECTOR, 'nav.nav-pill button span')]
        self.assertNotIn('Mi plan', labels)
        self.assertNotIn('Resultados', labels)
        self.assertNotIn('Alertas', labels)


if __name__ == '__main__':
    unittest.main(verbosity=2)
