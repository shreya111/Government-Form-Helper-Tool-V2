"""Form-requirement layer: which documents help which government form. Config-driven so new
forms can be added here without touching the UI. Labels carry en/hi so the panel can localise."""
from fastapi import APIRouter

forms_router = APIRouter(prefix="/api/forms")


def _doc(document_type, priority, en, hi, provides):
    return {"document_type": document_type, "priority": priority,
            "purpose": {"en": en, "hi": hi}, "provides": provides}


FORM_REQUIREMENTS = {
    "passport_fresh": {
        "form_id": "passport_fresh",
        "name": {"en": "Passport — Fresh Application", "hi": "पासपोर्ट — नया आवेदन"},
        "documents": [
            _doc("AADHAAR", "recommended",
                 "Identity and present address proof",
                 "पहचान और वर्तमान पते का प्रमाण",
                 ["full_name", "date_of_birth", "gender", "address", "street", "city", "state", "pincode", "father_name", "aadhaar_number"]),
            _doc("BIRTH_CERTIFICATE", "recommended",
                 "Date and place of birth proof",
                 "जन्म तिथि और जन्म स्थान का प्रमाण",
                 ["full_name", "date_of_birth", "place_of_birth", "gender", "father_name", "mother_name"]),
            _doc("PAN", "optional",
                 "Identity proof and PAN number",
                 "पहचान प्रमाण और पैन नंबर",
                 ["full_name", "date_of_birth", "father_name", "pan_number"]),
            _doc("VOTER_ID", "optional",
                 "Identity / address proof and Voter ID number",
                 "पहचान / पते का प्रमाण और वोटर आईडी नंबर",
                 ["full_name", "gender", "address", "street", "city", "state", "pincode", "father_name", "voter_id_number"]),
            _doc("CLASS_10_CERTIFICATE", "optional",
                 "Educational qualification and ECNR eligibility",
                 "शैक्षणिक योग्यता और ECNR पात्रता",
                 ["full_name", "date_of_birth", "father_name", "mother_name"]),
            _doc("UTILITY_BILL", "optional",
                 "Present address proof",
                 "वर्तमान पते का प्रमाण",
                 ["address", "street", "city", "state", "pincode"]),
            _doc("DRIVING_LICENCE", "optional",
                 "Identity / address proof",
                 "पहचान / पते का प्रमाण",
                 ["full_name", "date_of_birth", "address", "street", "city", "state", "pincode", "document_number"]),
        ],
    },
    "generic": {
        "form_id": "generic",
        "name": {"en": "Government form", "hi": "सरकारी फ़ॉर्म"},
        "documents": [
            _doc("AADHAAR", "recommended", "Identity and address proof", "पहचान और पते का प्रमाण",
                 ["full_name", "date_of_birth", "gender", "address", "pincode"]),
            _doc("PAN", "optional", "Identity proof", "पहचान प्रमाण",
                 ["full_name", "date_of_birth", "father_name"]),
        ],
    },
}


def get_requirements(form_id: str) -> dict:
    return FORM_REQUIREMENTS.get(form_id) or FORM_REQUIREMENTS["generic"]


@forms_router.get("")
async def list_forms():
    return [{"form_id": k, "name": v["name"]} for k, v in FORM_REQUIREMENTS.items()]


@forms_router.get("/{form_id}/requirements")
async def form_requirements(form_id: str):
    return get_requirements(form_id)
