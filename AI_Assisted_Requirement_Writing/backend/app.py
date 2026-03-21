import PyPDF2


def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, "rb") as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


# Step 4: Main code
if __name__ == "__main__":
    pdf_text = extract_text_from_pdf("AI_Assisted_Requirement_Writing/backend/sample.pdf")
    print(pdf_text)