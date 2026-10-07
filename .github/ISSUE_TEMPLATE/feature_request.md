name: Feature request
description: Suggest an idea (need first, solution second)
title: "[feature]: "
labels: ["feature"]
body:
  - type: textarea
    id: need
    attributes:
      label: Need (what can't you do today?)
      placeholder: e.g. the agent can't go back when a dialog traps it
    validations:
      required: true
  - type: textarea
    id: usage
    attributes:
      label: Use case (which app / task?)
      placeholder: e.g. dismissing cookie banners in Chrome
  - type: textarea
    id: alternative
    attributes:
      label: Workaround today, if any
  - type: dropdown
    id: scope
    attributes:
      label: Willing to test on your phone?
      options:
        - Yes, I can run test builds
        - Yes, release builds only
        - No
