#!/usr/bin/python

from common_imports import *
import pytest

# Basically a dummy test module since constants don't need much testing.
from video_src import constants

def test_one():
    assert constants.room_min_chars == 3

if __name__ == "__main__":
    pytest.main()
