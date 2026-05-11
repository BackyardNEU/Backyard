"""
Current list of items to resolve
* Whitespace:
    - Wait until later once the description data is suffiecntly cleaned to avoid possible errors.
* Getting images:
    - List of images scraped from site- have first element be the club logo, if one provided. Other images, if availible, will be scraped from the site.
    * Problems so far: 
        - Clubs have a ton of images right now and I don't know which ones to pick out
"""

from dataclasses import dataclass
from typing import Any, Optional
import time, json
from selenium import webdriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

def get_contact_info(driver: webdriver) -> list[Optional[str]]:
    #returns a list of all possible external contact redirects on the page
    return_list: list[Optional[str]] = [None, None, None]
    try:
        elements = driver.find_elements(By.XPATH, "//a[contains(@aria-label, 'Visit our ')]") #find external site, if one availible
    except(NoSuchElementException):
        print("Could not find external site")
    for i in range(len(elements)):
        if "https://www" not in elements[i].get_attribute("href"):
            return_list[0] = elements[i].get_attribute("href")
        elif "instagram" in elements[i].get_attribute("href"):
            return_list[1] = elements[i].get_attribute("href")
        elif "facebook" in elements[i].get_attribute("href"):
            return_list[2] = elements[i].get_attribute("href")
    return return_list

#accepts a list of webelement objects, analyzes what type of object it is, and then takes the text and assigns it as a corresponding key
#I'm pretty sure the only elements that are in this div are p elements and ul -> 
#returns a list of either p and ul elements and their texts as tuples. If there is a ul element, it will loop through it and take all of the li elements and put them
# in a list which will then be assigned to 'ul' in a tuple.   
def scan_user_div() -> list[(str, Any)]:
    return_list: list[(str, str)] = []
    root_div = waiting_time.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div.bodyText-large.userSupplied")))
    elements: list[WebElement] = root_div.find_elements(By.CSS_SELECTOR, "p, ul")
    for element in elements:
        if element.tag_name == 'p':
            return_list.append(('p', element.text.replace('\n\n', " ").replace('\n', " ")))
        elif element.tag_name == 'ul':
            ul_list: list[str] = [ul_element.text.replace('\n\n', " ").replace('\n', " ") for ul_element in element.find_elements(By.TAG_NAME, 'li')]
            return_list.append(('ul', ul_list))
        else:
            print("Unidentified element in div")
    return return_list

opts = Options()
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--disable-extensions")
opts.add_argument("--disable-gpu")
opts.add_argument("--disable-background-timer-throttling")
opts.add_argument("--disable-renderer-backgrounding")
opts.add_argument("--disable-backgrounding-occluded-windows")
opts.add_argument("--no-sandbox")

#before I was just using dictionaries. Now I have to use a dataclass because there is too much complex data
@dataclass
class Club():
    title: str
    description: list[str, Any]
    logo_url: Optional[str]
    email: Optional[str]
    instagram: Optional[str]
    facebook: Optional[str]
    external_link: Optional[str]

club_list: list[Club] = []

driver = webdriver.Chrome(options=opts)
waiting_time = WebDriverWait(driver, 10)

driver.get("https://wit.campuslabs.com/engage/organizations")
print(driver.title)
button_element = driver.find_element(By.XPATH, "//div[@class='outlinedButton']//button[contains(., 'Load More')]")
print(button_element.text)

#Loads all of the data before scraping so all the listings can be clicked

while True:
    try:
        #Click the button after waiting for it to load
        load_button = waiting_time.until(EC.element_to_be_clickable(driver.find_element(By.XPATH, "//div[@class='outlinedButton']//button[contains(., 'Load More')]")))
        load_button.click()
        print("Clicked button")
        
        #scroll after clicking the button so the button can be clicked again
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1)

    #if this exception triggers, then the page is done loading because the button will disappear
    except(TimeoutException, NoSuchElementException):
        print("Page done loading")
        break

#store every elements href because storing the webelements would take too much memory and cause crashes
container = driver.find_element(By.ID, "org-search-results")
href_list = [element.get_attribute('href') for element in container.find_elements(By.TAG_NAME, "a")]

#start scraping the actual data here
print("\n***SCRAPING STARTS HERE:***\n")
for i in range(len(href_list)):
    #navigate to particular listing
    driver.get(href_list[i])
    print("Navigated to listing!")

    #define all needed variables here. email and image_url are optional because not every club has both
    logo_url: Optional[str] = None
    email: Optional[str] = None

    #wait until the h1 element has loaded before grabbing. This ensures that the rest of the page likely has loaded too
    club_name = waiting_time.until(EC.presence_of_element_located((By.XPATH, "//h1"))).text
    #grabs the description of the club by getting all of the p elements and then combining them into one
    
    description: list[str, Any] = scan_user_div()

    #attempt to grab image_url
    try:
        logo_url = driver.find_element(By.XPATH, "//img").get_attribute("src")
        
    except(NoSuchElementException):
        print("No url found")
    #attempt to grab email
    try:
        email = driver.find_element(By.XPATH, "//strong/..").text[17:]
    except(NoSuchElementException):
        print("No email found")

    links: Optional[str] = get_contact_info(driver)

    #create new club object and append to list
    club_list.append(Club(club_name, description, logo_url, email, links[0], links[1], links[2]))

#stop driver
driver.quit()

#test to see if the data is good
print(club_list)

club_data: list[list[Optional[str]]] = [[club.title, club.description, club.logo_url, club.email,
                                         club.instagram, club.facebook, club.external_link] for club in club_list]

#write into a json file
with open('wentworth_data.json', 'w') as f:
    json.dump(club_data, f, ensure_ascii=False)