name: Bug report
description: Something doesn't work on your phone
title: "[bug]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: Thanks for reporting. Fill what you can — the more precise, the faster the fix.
  - type: input
    id: version
    attributes:
      label: App version
      placeholder: e.g. 0.1.0 (Settings → About)
    validations:
      required: true
  - type: input
    id: device
    attributes:
      label: Phone + Android version
      placeholder: e.g. SM-A520F, Android 8
    validations:
      required: true
  - type: textarea
    id: task
    attributes:
      label: Task launched (exact prompt)
      placeholder: e.g. météo à Cotonou
    validations:
      required: true
  - type: textarea
    id: verdict
    attributes:
      label: Run card verdict (copy the text)
      placeholder: Paste what the agent card / error message says
    validations:
      required: true
  - type: dropdown
    id: key
    attributes:
      label: API key status
      options:
        - Configured (Test passes)
        - Configured (Test fails)
        - Not configured
  - type: dropdown
    id: a11y
    attributes:
      label: Accessibility service enabled for Oh-Matilda?
      options:
        - Yes
        - No
        - Not sure
  - type: textarea
    id: extra
    attributes:
      label: Anything else (screenshot welcome)
      description: Screenshots of the run card help a lot. Never paste your API key.
