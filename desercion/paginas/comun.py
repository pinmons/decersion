"""Piezas de HTML que comparten varias páginas."""

SELECTOR_MODELO = """<fieldset class="selector-modo selector-operacion">
            <legend>Quién califica</legend>
            <div class="segmentado" role="radiogroup" aria-label="Modelo">
              <label><input type="radio" name="modelo-operacion" value="logistica" checked><span>Regresión logística</span></label>
              <label><input type="radio" name="modelo-operacion" value="red_neuronal"><span>Red neuronal</span></label>
              <label><input type="radio" name="modelo-operacion" value="reglas"><span>Reglas del contrato</span></label>
            </div>
          </fieldset>"""
