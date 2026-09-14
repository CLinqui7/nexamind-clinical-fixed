"""Read-only smoke suite. Does not create users, send invitations or charge money."""
import os,unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
class LinkarePublicAccessSmoke(unittest.TestCase):
 def setUp(self):
  options=webdriver.ChromeOptions()
  if os.environ.get('LINKARE_QA_HEADED')!='1':options.add_argument('--headless=new')
  options.add_argument('--window-size=1440,1000');self.driver=webdriver.Chrome(options=options)
  self.driver.get(os.environ.get('LINKARE_QA_URL','http://localhost:4173'))
  WebDriverWait(self.driver,20).until(EC.visibility_of_element_located((By.CSS_SELECTOR,'input[type="email"]')))
 def tearDown(self):self.driver.quit()
 def test_01_no_public_test_credentials(self):
  body=self.driver.find_element(By.TAG_NAME,'body').text.lower()
  for text in ['nexamind2026!','agenda2026!','@nexamind.demo','cuenta de demostración']:self.assertNotIn(text,body)
  self.assertIn('crear consultorio',body)
 def test_02_recovery_screen(self):
  self.driver.find_element(By.XPATH,"//button[contains(.,'Olvidé mi contraseña')]").click()
  self.assertIn('Enviar enlace',self.driver.find_element(By.TAG_NAME,'body').text)
 def test_03_mobile_no_horizontal_overflow(self):
  self.driver.set_window_size(375,812)
  widths=self.driver.execute_script('return [window.innerWidth,document.documentElement.scrollWidth]')
  self.assertLessEqual(widths[1],widths[0]+1)
if __name__=='__main__':unittest.main(verbosity=2)
