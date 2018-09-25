# DevDock

> Docs and an example are coming soon!


This project is a prototype that builds on top of Docker App (yet another experimental tool) to make it easy to spin up local dev environments. The use case lies in applications that are composed of many services (backend, multiple frontends, etc.) and developing in one service needs the other components running.

Long term, it's likely this will be moved from Node to something like Go to prevent the need of having a Node runtime. But, since I'm more familiar with Node, decided to start there to flush out the idea.

## Installation

```
npm install -g devdock
```

## Docker App Configuration

In order to work, the Docker App you wish to use must have additional service metadata to indicate the service can be disabled and the name to be used in the interactive menus.

- `x-enabled` - used by Docker App to actually disable and remove the service when being rendered
- `x-devdock-description` - a human friendly name to be used in the interactive menus
- `x-devdock-setting` - the name of the setting that must be `false` in order to disable the service

### Example Docker App Compose File (truncated)

```yaml
version: "3.7"
services:
  api:
    image: sample-api-image
    x-enabled: ${enable-api}
    x-devdock-description: API/Backend
    x-devdock-setting: enable-api
    ...
  frontend:
    image: sample-frontend-image
    x-enabled: ${enable-frontend}
    x-devdock-description: Browser Frontend
    x-devdock-setting: enable-frontend
    ...
```

## Usage

To use the terminal menu to disable/enable services, simply run (notice no additional arguments):

```
devdock [PROJECT-NAME] [APP-IMAGE]
```

In addition, all Docker Compose commands are specified when added to the end. For example:

```
devdock [PROJECT-NAME] [APP-IMAGE] ps
```

To make things simple, you can make aliases that make it even easier. For example, a project I'm on (named Summit) can have it's own "Summit CLI" by simply adding this to our `~/.bash_profile`:

```
alias summit="devdock summit path/to/summit.dockerapp $@"
```

## Example

COMING SOON!

## Roadmap

There are a few things I'd like to see, as we already have use cases for them. Here are a few items...

- Ability to overlay additional compose files (to mount volumes, expose ports, etc.)
- 

## License

This project is licensed using the MIT license. See [LICENSE](./LICENSE)