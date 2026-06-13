# Demo workspace

Sample project for CodeForge on EC2. Ask the agent to explain this repo, suggest improvements, or write code here.

## API for Authentication

This project includes a simple authentication API using Python. Below is an example of how to implement basic authentication endpoints.

### Endpoints

- `POST /api/login`
- `POST /api/register`

### Usage

To use the authentication API, make sure to provide the necessary payload in the requests.

```python
# Hello World Python Program
print("Hello, World!")
```

> test

> write a test code for python ? Hello world

## Running Tests

To run the tests for this project, ensure you have pytest installed. Run the following command:

```bash
python -m pytest -q test_hello.py
```

If you encounter an issue with PowerShell, consider using a different terminal or command prompt compatible with Python.

## Test Code

Here is a simple test code for the "Hello, World!" program:

```python
def test_hello_world(capsys):
    print("Hello, World!")
    captured = capsys.readouterr()
    assert captured.out == "Hello, World!\n"
```
