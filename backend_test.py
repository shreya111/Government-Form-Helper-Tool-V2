import requests
import sys
import json
from datetime import datetime

class GovernmentFormHelperTester:
    def __init__(self, base_url="https://formwise-demo.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, str(e))
            return False

    def test_form_help_endpoint(self):
        """Test the main form help endpoint"""
        try:
            payload = {
                "field_label": "Given Name (First & Middle Name)",
                "field_type": "input",
                "form_context": "Indian Passport Application Form"
            }
            
            response = requests.post(
                f"{self.api_url}/form-help", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30  # Increased timeout for AI response
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                # Check if response has required fields
                required_fields = ["clarification_question", "advice", "warning", "field_label"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    success = False
                    details += f", Missing fields: {missing_fields}"
                else:
                    details += f", All required fields present"
                    # Check if fields have content
                    empty_fields = [field for field in required_fields if not data.get(field)]
                    if empty_fields:
                        details += f", Empty fields: {empty_fields}"
                    else:
                        details += f", All fields have content"
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except ValueError:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test("Form Help Endpoint", success, details)
            return success, response.json() if success else {}
            
        except Exception as e:
            self.log_test("Form Help Endpoint", False, str(e))
            return False, {}

    def test_ecr_field_specific(self):
        """Test ECR/ECNR field specifically as mentioned in requirements"""
        try:
            payload = {
                "field_label": "ECR / ECNR Status",
                "field_type": "select",
                "form_context": "Indian Passport Application Form"
            }
            
            response = requests.post(
                f"{self.api_url}/form-help", 
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                # Check if response mentions passport-specific guidance
                advice_text = data.get("advice", "").lower()
                passport_related = any(keyword in advice_text for keyword in 
                                     ["passport", "emigration", "ecr", "ecnr", "travel", "visa"])
                
                if passport_related:
                    details += ", Contains passport-specific guidance"
                else:
                    details += ", May lack passport-specific context"
                    
            self.log_test("ECR/ECNR Field Guidance", success, details)
            return success
            
        except Exception as e:
            self.log_test("ECR/ECNR Field Guidance", False, str(e))
            return False

    def test_extension_download(self):
        """Test extension zip download endpoint"""
        try:
            response = requests.get(f"{self.api_url}/extension/download", timeout=10)
            success = response.status_code == 200 and response.headers.get('content-type', '').startswith('application/zip')
            details = f"Status: {response.status_code}, Size: {len(response.content)} bytes"
            self.log_test("Extension Download", success, details)
            return success
        except Exception as e:
            self.log_test("Extension Download", False, str(e))
            return False

    def test_form_help_history(self):
        """Test form help history endpoint"""
        try:
            response = requests.get(f"{self.api_url}/form-help/history", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                details += f", History entries: {len(data) if isinstance(data, list) else 'Invalid format'}"
                
            self.log_test("Form Help History", success, details)
            return success
            
        except Exception as e:
            self.log_test("Form Help History", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting FormWise Backend Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_api_root():
            print("❌ API root failed - stopping tests")
            return False
            
        # Test main functionality
        form_help_success, _ = self.test_form_help_endpoint()
        if not form_help_success:
            print("❌ Main form help endpoint failed")
            
        # Test specific ECR field
        self.test_ecr_field_specific()
        
        # Test other endpoints
        self.test_extension_download()
        self.test_form_help_history()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Backend Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return True
        else:
            print("⚠️  Some backend tests failed")
            return False

def main():
    tester = GovernmentFormHelperTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())