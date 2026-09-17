# Configuration

Before running the project, you need to configure a `.env` file at the root fo the project (docker) or of the `app` directory (manual).

## Environment variables

### Authentication

| Variable | Description |
| --- | --- |
| `AUTH_SECRET` | Secret key used to sign and encrypt session tokens. |
| `AUTH_URL` | Base URL of the application, used by the auth provider for callbacks. In development, this is `http://localhost:3000`. |

### GitHub

| Variable | Description |
| --- | --- |
| `GITHUB_TOKEN` | Personal access token used to interact with the GitHub API. Must start with `ghp_`. |

 
:::info[Utility]
 
The personal access token does not need any scopes.
 
It is used to fetch the templates of projects from the GitHub API.
 
Using a token increases the rate limit to **5,000 requests** per hour. If you plan to use the API concurrently with multiple users, you may need to request a higher-tier token. See the details [here](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
 
:::

### Keycloak (SSO)

| Variable | Description |
| --- | --- |
| `AUTH_KEYCLOAK_ID` | Client ID of the application registered in Keycloak. |
| `AUTH_KEYCLOAK_SECRET` | Client secret associated with the Keycloak application. |
| `AUTH_KEYCLOAK_ISSUER` | Issuer URL of the Keycloak realm used for authentication. |

:::tip[Getting Keycloak credentials]

If you don't have a Keycloak client ID and secret, contact **Pierre-André Mudry** or **Yacine Said** to get access to the `isc-vs.ch` realm.

:::

## Example

```dotenv
AUTH_SECRET=

AUTH_URL=http://localhost:3000
GITHUB_TOKEN=ghp_

AUTH_KEYCLOAK_ID=your_app_id
AUTH_KEYCLOAK_SECRET=your_app_secret
AUTH_KEYCLOAK_ISSUER=https://sso.isc-vs.ch/realms/isc
```

:::warning[Never commit your `.env`]

The `.env` file contains sensitive credentials and must never be committed to the repository.

:::