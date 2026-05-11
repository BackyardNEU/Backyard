import pandas as pd
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

#PLEASE READ: SCRAPER ALMOST DONE JUST NEED TO WORK OUT A FEW KINKS

# Load CSV
df = pd.read_csv("demo_club_data_rows-3.csv")

# Chrome setup
chrome_options = Options()
chrome_options.add_argument("--start-maximized")

driver = webdriver.Chrome(options=chrome_options)

instagram_urls = []

for club in df["club_name"]:
    
    if "northeastern" not in club.lower():
        query = f"{club} northeastern instagram"
    else:
        query = f"{club} instagram"

    search_url = f"https://www.google.com/search?q={query.replace(' ', '+')}"

    driver.get(search_url)

    time.sleep(2)

    links = driver.find_elements(By.TAG_NAME, "a")

    insta_link = None

    for link in links:
        href = link.get_attribute("href")
        if href and "instagram.com" in href:
            insta_link = href
            break

    instagram_urls.append(insta_link)

    print(f"{club} -> {insta_link}")

    time.sleep(2)

driver.quit()

df["instagram_url"] = instagram_urls
print(instagram_urls)

df.to_csv("clubs_with_instagram.csv", index=False)