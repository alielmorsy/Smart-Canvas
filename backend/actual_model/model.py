import os

# for faster loading
os.environ["MKL_THREADING_LAYER"] = "GNU"
os.environ["OMP_NUM_THREADS"] = "1"

import cv2
import numpy as np
import torch
import PIL.Image as Image
from torch import nn
import torch.nn.functional as F
from torchvision.transforms import transforms, InterpolationMode

torch.set_default_device("cuda")

NUM_OF_FEATURES = 75


class ThresholdTransform:
    def __call__(self, img):
        # Convert the image from PIL to NumPy array
        img_np = np.array(img)

        # Apply the thresholding
        threshold_image = cv2.threshold(img_np, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]

        # Convert the threshold image back to PIL format
        threshold_image = Image.fromarray(threshold_image)

        return threshold_image


transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Grayscale(),
    ThresholdTransform(),
    # Apply before ToTensor
    transforms.Resize((128, 128), interpolation=InterpolationMode.NEAREST),
    # transforms.RandomRotation(degrees=5),  # Rotate before ToTensor for less overhead
    # transforms.GaussianBlur((1, 1), sigma=1),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5], std=[0.5]),
])


class Model(nn.Module):
    def __init__(self, labels_count):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels=1, out_channels=32, kernel_size=(3, 3), padding=1)
        self.conv2 = nn.Conv2d(in_channels=32, out_channels=64, kernel_size=(3, 3), padding=1)
        self.conv2_norm = nn.BatchNorm2d(64)
        self.conv3 = nn.Conv2d(in_channels=64, out_channels=128, kernel_size=(3, 3), padding=1)
        self.conv3_norm = nn.BatchNorm2d(128)
        self.fc1 = nn.Linear(128 * 32 * 32, 256)
        self.fc2 = nn.Linear(256, labels_count)

        self.pool = nn.MaxPool2d((2, 2), stride=2)
        self.dropout = nn.Dropout(p=0.5)

    def forward(self, x):
        y = F.relu(self.conv1(x))
        y = F.relu(self.conv2(y))
        y = self.pool(y)
        y = self.conv2_norm(y)

        y = F.relu(self.conv3(y))
        y = self.pool(y)
        y = self.conv3_norm(y)
        y = y.view(y.size(0), -1)
        y = F.relu(self.fc1(y))
        y = self.dropout(y)
        return self.fc2(y)


model: Model = None
labels = None


def load_model():
    global model, labels
    loaded_data = torch.load("checkpoint")
    labels = loaded_data["labels"]
    model = Model(len(labels))
    model.load_state_dict(loaded_data["model"])
    del loaded_data


def predict(image, threshold=0.6):
    # if torch.cuda.is_available():
    #     torch.cuda.manual_seed_all(42)
    torch.manual_seed(42)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(42)
    with torch.no_grad():
        model.eval()
        image = transform(image).unsqueeze(0).cuda()
        # i = image.numpy().squeeze(0)
        # cv2.imshow("imgae", i)
        # cv2.waitKey(0)
        o = model(image)
        o = F.softmax(o, dim=1)
        max_value, index = torch.max(o, dim=1)
        print(f"{labels[index]} = {max_value}")
        # I am doing that because one is hard to detect or my handwriting is bad IDK. but it was corerct one and
        # that's what I care about
        if max_value < threshold and labels[index] == "1":
            return "1"

    if max_value < threshold:
        return "unknown"
    else:
        return labels[index]
