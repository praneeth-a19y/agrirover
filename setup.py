from setuptools import setup

setup(
    name="agrirover",
    version="1.0.0",
    description="Smart Agriculture Rover Monitoring Platform",
    scripts=["agrirover"],
    py_modules=["launch"],
    install_requires=[],
    entry_points={
        "console_scripts": [
            "agrirover=launch:run_server",
        ],
    },
)
