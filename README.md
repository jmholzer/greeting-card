<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a name="readme-top"></a>
<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/jmholzer/greeting-card">
    <img src="README_images/logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Greeting Card</h3>

  <p align="center">
    A free, customizable, and self-hostable greeting card template built using Next.js and Framer Motion. It allows multiple people to sign and contribute to a digital card that you can customise for whatever occasion.
    <br />
    <a href="https://github.com/jmholzer/greeting-card">View Demo</a>
    ·
    <a href="https://github.com/jmholzer/greeting-card/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    ·
    <a href="https://github.com/jmholzer/greeting-card/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project

[![Product Name Screen Shot][product-screenshot]](https://example.com)

View the card at the main route (`/`).

Sign the card at `/sign`. Supports up to 16 messages.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![Next][Next.js]][Next-url]
* [![React][React.js]][React-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Self-hosting on Vercel

0. Clone the repo

   ```sh
   git clone https://github.com/jmholzer/greeting-card.git
   ```

1. Customise your card: add a `front.jpg` to be the fro

   * Add a `front.jpg` with aspect ratio 1:1.414 (landscape). [Canva](https://www.canva.com/create/greeting-cards/) is a good place to find design templates.
   * Modify `app/favicon.ico`.
   * Modify the title / description of the page in `app/layout.tsx`.

2. Install NPM packages

   ```sh
   npm install
   ```

3. Install the Vercel CLI and login

   ```sh
   npm i -g vercel
   vercel login
   ```

4. Deploy a new Vercel project for your card

   ```sh
   vercel deploy
   ```

5. [Create a Postgres database on Vercel and connect it with your new project](https://vercel.com/docs/storage/vercel-postgres/quickstart#create-a-postgres-database)

6. Add the `HOST` environment variable to the Vercel project (this can be any URL that points to your deployment)

   ```sh
   HOST=https://greeting-card-demo.vercel.app
   ```

7. Pull the DB environment variables to your local

   ```sh
   vercel env pull 
   ```

8. Create a Prisma client

   ```sh
   npx prisma generate
   ```

9. Create the DB tables

   ```sh
   npx prisma db push
   ```

10. Redeploy your project to load the new env vars

   ```sh
   vercel --prod
   ```

11. Navigate to your project's URL and check that you can view (`/`) and sign (`/sign`) the card.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing

See the [open issues](https://github.com/jmholzer/greeting-card/issues) for a full list of proposed features (and known issues).

Feel free to open an issue or contribute a PR:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact

Project Link: [https://github.com/jmholzer/greeting-card](https://github.com/jmholzer/greeting-card)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* []()
* []()
* []()

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/jmholzer/greeting-card.svg?style=for-the-badge
[contributors-url]: https://github.com/jmholzer/greeting-card/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/jmholzer/greeting-card.svg?style=for-the-badge
[forks-url]: https://github.com/jmholzer/greeting-card/network/members
[stars-shield]: https://img.shields.io/github/stars/jmholzer/greeting-card.svg?style=for-the-badge
[stars-url]: https://github.com/jmholzer/greeting-card/stargazers
[issues-shield]: https://img.shields.io/github/issues/jmholzer/greeting-card.svg?style=for-the-badge
[issues-url]: https://github.com/jmholzer/greeting-card/issues
[license-shield]: https://img.shields.io/github/license/jmholzer/greeting-card.svg?style=for-the-badge
[license-url]: https://github.com/jmholzer/greeting-card/blob/master/LICENSE.txt
[product-screenshot]: README_images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
