#!/usr/bin/python

from common_imports import *
import pytest

# For the moment, this is basically just a dummy test module, so don't take it too seriously.
from video_src import constants

def test_one():
    assert constants.room_min_chars == 3

if __name__ == "__main__":
    pytest.main()
