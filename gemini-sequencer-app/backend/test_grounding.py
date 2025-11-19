import os
import google.generativeai as genai
from google.ai.generativelanguage_v1beta.types import Tool
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def test_grounding():
    model_name = "gemini-2.5-flash"
    print(f"Testing with model: {model_name}")

    # Attempt 14: Tool(google_search=Tool.GoogleSearch()) with 2.5-flash
    try:
        print("\nAttempt 14: Tool(google_search=Tool.GoogleSearch())")
        tool = Tool(google_search=Tool.GoogleSearch())
        model = genai.GenerativeModel(model_name, tools=[tool])
        response = model.generate_content("What is the stock price of Google right now?")
        print("Success!")
        print(f"Text: {response.text}")
        if response.candidates[0].grounding_metadata.search_entry_point:
             print("Grounding Metadata Found!")
             print(response.candidates[0].grounding_metadata)
        else:
             print("No Grounding Metadata found.")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_grounding()
