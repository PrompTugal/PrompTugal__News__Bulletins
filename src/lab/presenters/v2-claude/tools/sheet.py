import sys
from PIL import Image
out, cols, *files = sys.argv[1:]
cols = int(cols); ims = [Image.open(f) for f in files]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
s = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims): s.paste(im, ((i % cols) * w, (i // cols) * h))
s.save(out)
