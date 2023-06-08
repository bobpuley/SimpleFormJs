const ScriptGenerator = (function ($) {

    if (!!!$) throw Error('jQuery is required. Try to add the following code to you page:<script src="https://code.jquery.com/jquery-3.6.3.min.js" integrity="sha256-pvPw+upLPUjgMXY0G+8O0xUf+/Im1MZjXxxgOcBQBXU=" crossorigin="anonymous"><\/script>');

    const formFieldTemplate = `
    <div class="inputForm">
        <label for="{{fieldName}}">
            <span class="form-label">{{fieldName}}:</span>
            {{#if values}}
            <input name="{{fieldName}}_text" class="{{fieldName}}_text" placeholder="{{placeholder}}" />
            <input type="hidden" name="{{fieldName}}" class="{{fieldName}}" />
            {{else}}
            <input name="{{fieldName}}" class="{{fieldName}}" placeholder="{{placeholder}}" value="{{placeholder}}" />
            {{/if}}
        </label>
    </div>
`;
    const displayFieldTemplate = `
    {{#each .}}
        <h2>{{name}}</h2>
        <div id="{{id}}" class="code"></div>
    {{/each}}
`;
    const bodyContentTemplate = `
    <!-- BODY CONTENT -->
    <div class="container">
        <div class="formContainer" style="display: none;">
            <div class="formInputContainer">
            </div>
            <div class="inputForm"><button type="button">Excute</button></div>
        </div>
        <div class="scriptsContainer" style="display: none;">
            <button type="button">Reset</button>
            <pre class="scriptsDisplay"></pre>
        </div>
    </div>
`;

    class ScriptGenerator {
        constructor(formSchema, generatorId) {
            this.componentSelector = generatorId ? $(`#${generatorId}`) : $;
            this.formSchema = formSchema;
            this.loadTemplates(); 
            this.createForm();
        }

        get(selector) {
            return this.componentSelector.find(selector);
        }
        getTemplate(templateName) {
            return $(`script[type="script/templates"][name="${templateName}"]`);
        }

        loadTemplates() {
            this.TEMPLATES = {
                resultTemplates: $.makeArray(this.get('script[type="text/templates"]')).map(this.toTemplateItem),
                formFieldTemplate: Handlebars.compile(formFieldTemplate),
                displayFieldTemplate: Handlebars.compile(displayFieldTemplate)
            };
        }
        loadAndCompileTemplate(name) {
            return Handlebars.compile(this.getTemplate(name).html());
        }
        toTemplateItem(element) {
            element = $(element);
            return {
                name:       element.attr("name"), 
                id:         element.attr("name").replace(/\W/g,'_'), 
                template:   Handlebars.compile(element.html())
            };
        }
        createForm() {
            this.componentSelector.append(bodyContentTemplate);
            this.get('.formInputContainer').html(this.formSchema.map(this.TEMPLATES.formFieldTemplate).join(''));
            this.formSchema.forEach(this.setupField.bind(this));
            this.get('.formContainer button').click(this.execute.bind(this));
            this.get('.scriptsContainer button').click(this.resetForm.bind(this));

            this.resetForm();
        }
        setupField(schema) {
            schema.field = schema.values 
                ? new AutoSuggest(this.get(`.${schema.fieldName}`), this.get(`.${schema.fieldName}_text`), schema.values)
                : this.get(`.${schema.fieldName}`);
        }
        resetForm() {
            this.get('.formContainer').show();
            this.get('.scriptsContainer').hide();
        }
        execute() {
            let params = this.formSchema.reduce((target, item) => (target[item.fieldName]=item.field.val(), target), {});
            this.get('.formContainer').hide();
            this.createScriptsDisplay(this.TEMPLATES.resultTemplates, params);
            this.get('.scriptsContainer').show();
        }

        createScriptsDisplay(templates, params) {
            this.get('.scriptsDisplay').html(this.TEMPLATES.displayFieldTemplate(this.TEMPLATES.resultTemplates));
            this.TEMPLATES.resultTemplates.forEach(template => {
                this.get(`#${template.id}`).html(template.template(params));
            });
        }
    }

    class AutoSuggest {

        constructor(field, fieldText, values) {
            this.field = field;
            this.fieldText = fieldText;
            this.values = values;
            this.setupEvent();
        }
        
        setupEvent() {
            this.fieldText.keyup(this.handleSuggestions.bind(this));
        }

        handleSuggestions(event) {
            if(event.originalEvent.keyCode < 65 || event.originalEvent.keyCode > 90) return;
            let filter = this.text();
            let filterMatcher = this.getFilterMatcher(filter);
            let suggestion = this.values.find(filterMatcher);
            if (suggestion) {
                this.updateFields(suggestion, filter);
            } else {
                this.val('');
            }
        }
        
        getFilterMatcher(filter) {
            filter = filter.toLowerCase();
            return (evaluable) => (evaluable.text || evaluable).toLowerCase().indexOf(filter)===0;
        }
        
        updateFields(suggestion, filter) {
            let text = suggestion.text || suggestion;
            let val = suggestion.value || suggestion;
            this.text(text);
            this.fieldText.focus();
            this.fieldText.get(0).setSelectionRange(filter.length, text.length);
            this.val(this.values.indexOf(suggestion) >= 0 ? val : '');
        }
        val(text) {
            return typeof text === 'undefined' ? this.field.val() :  this.field.val(text);
        }
        text(text) {
            return typeof text === 'undefined' ? this.fieldText.val() :  this.fieldText.val(text);
        }
    }

    return ScriptGenerator;
})(jQuery)