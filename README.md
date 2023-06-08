SimpleFormJs
============

SimpleFormJs is a JavaScript library that simplifies the process of generating dynamic forms and executing scripts based on user input. It requires jQuery and Handlebars.js to be included in your project.

Installation
------------

To use SimpleFormJs, make sure you have included the following dependencies in your HTML file:

-   jQuery: Add the following code to your page's `<head>` tag:
```html
    <script src="https://code.jquery.com/jquery-3.6.3.min.js" integrity="sha256-pvPw+upLPUjgMXY0G+8O0xUf+/Im1MZjXxxgOcBQBXU=" crossorigin="anonymous"></script>
```
-   Handlebars.js: Include the Handlebars.js library in your project. You can download it from the official website or include it via a CDN.

Usage
-----

1.  Clone the SimpleFormJs repository from GitHub:

    `git clone https://github.com/bobpuley/SimpleFormJs.git`

2.  Include the necessary dependencies in your HTML file:
```html
    <script src="path/to/jquery.min.js"></script>
    <script src="path/to/handlebars.min.js"></script>
    <script src="path/to/SimpleFormJs.js"></script>
```

3.  Initialize the library by creating an instance of the `ScriptGenerator` class:
```javascript
    const formSchema = [
      // Define your form schema here
    ];

    const generatorId = 'your-generator-id'; // Optional

    const scriptGenerator = new ScriptGenerator(formSchema, generatorId);`
```
4.  Customize the form schema to meet your requirements. The `formSchema` parameter is an array of objects representing each form field. Each object should have the following properties:

    -   `fieldName`: The name of the field.
    -   `placeholder`: The placeholder text for the field.
    -   `values` (optional): An array of predefined values for the field. If provided, an auto-suggest feature will be enabled for the field.

    Example form schema:
```javascript
    const formSchema = [
      {
        fieldName: 'name',
        placeholder: 'Enter your name',
      },
      {
        fieldName: 'email',
        placeholder: 'Enter your email address',
      },
      {
        fieldName: 'country',
        placeholder: 'Select your country',
        values: ['USA', 'Canada', 'UK', 'Australia'],
      },
    ];
```

5.  Customize the templates (optional): SimpleFormJs uses Handlebars.js templates for rendering form fields and displaying the script results. If you want to customize the templates, you can modify the `formFieldTemplate` and `displayFieldTemplate` constants in the `SimpleFormJs.js` file.

6.  Build and run your project. You should now see the dynamically generated form on your webpage. Fill in the form fields and click the "Execute" button to display the generated script results.

License
-------

This library is licensed under the MIT License. For more information, please refer to the [LICENSE](https://github.com/bobpuley/SimpleFormJs/blob/main/LICENSE) file.

Repository
----------

The source code for SimpleFormJs can be found on GitHub: <https://github.com/bobpuley/SimpleFormJs>

Distribution
------------

SimpleFormJs is distributed using jsdeilvr.
