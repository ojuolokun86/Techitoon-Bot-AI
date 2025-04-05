from paddleocr import PaddleOCR
import sys

ocr = PaddleOCR()
result = ocr.ocr(sys.argv[1], cls=True)

for line in result:
    for word in line:
        print(word[1][0])  # Extract text