# Power Electronics – interactive circuits

Static website (plain HTML + JavaScript, **no build step, no server, no external libraries**) that simulates the circuits of the
Power Electronics lecture note. Choose a circuit, change any parameter with the sliders (or type a value) and the waveshapes,
harmonic spectrum and all performance figures update immediately. Every result is compared with the closed-form
expression of the note wherever one exists (green tick = agreement within 2 %).

## 1. Put it online (GitHub Pages) – 5 minutes

1. Create a new repository on GitHub (for example `pe-interactive`) and upload **all files of this folder** (keep the folder structure).
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to the `main` branch. The workflow `.github/workflows/pages.yml` runs the tests and publishes the site at
   `https://<your-user>.github.io/<repo>/`.
   (If you prefer no workflow: Settings → Pages → *Deploy from a branch* → `main` / root. The file `.nojekyll` is already included.)

You can also just double-click `index.html`: it works from the file system too.

## 2. Link the figures of the LaTeX note

In `preamble.tex` set

```latex
\def\baseurl{https://<your-user>.github.io/<repo>/}
```

Every `\waveI{figure-id}{...}` then prints "[ interactive version ]" and links to `<baseurl>#figure-id`. A link opens the simulator with the
parameters that reproduce that figure of the note. For the figure IDs used in chapters 1–3 the mapping already exists in `js/aliases.js`.
For a figure you added yourself, add one line to that file:

```js
'my-figure-id': { model: 'rect-1ph-fw', params: { dev: 'thyristor', alpha: 60, L: 50 } },
```

Links also work without an alias: `#rect-1ph-fw?alpha=60&L=50&dev=thyristor` (model id, then `?key=value&...`). The address bar is updated while
you move the sliders, so the **Copy link** button always gives a link to the exact state on the screen (QR codes can point to it as well).

## 3. What the simulators do

* Time-domain numerical simulation (RK4, 0.1° steps for the line-frequency circuits, 400 steps per switching period for the DC-DC converters) of the
  circuit with ideal switches; steady state is found automatically (several periods are discarded).
* Rectifiers use one engine for half-wave / bridge / 3-phase circuits with **R, R-L, R-L-E (battery) load, device drop and an optional
  freewheeling diode**; conduction ends when the current reaches zero (discontinuous mode) and thyristors hand over by natural commutation.
  Gate pulses are assumed to stay applied until the end of the half-cycle (an SCR therefore fires as soon as it is forward biased after α).
* The three-phase AC controller finds the conducting thyristors by testing every consistent combination at every step (gate pulses 120° wide, as in the note).
* DC-DC converters are simulated through CCM **and DCM** (diode current reaching zero); the readouts show the CCM or DCM formula that applies.
* Harmonic figures (HF_n, THD, DF, LOH) are computed exactly as defined in the note, from the simulated waveform.
* Hover or touch the plot to read all traces at one instant; **CSV** and **SVG** buttons export the data / the figure.

## 4. Circuits included (model ids and parameter keys)

Use these ids in links and in `js/aliases.js`.

### Switches & SCR commutation

**`scr-latch`** – SCR latching: minimum gate-pulse width (worked problems)  
`V`, `R`, `L`, `IL`, `pw`, `Rp`

**`comm-classA`** – Forced commutation, Class A (load / self commutation)  
`V`, `R`, `L`, `C`

**`comm-classB`** – Forced commutation, Class B (resonant pulse / current commutation)  
`V`, `IL`, `L`, `C`, `tA`

**`comm-classC`** – Forced commutation, Class C (complementary / impulse commutation)  
`Vs`, `R1`, `R2`, `C`, `t1`, `t2`


### AC → AC converters

**`acvc-1ph`** – Single-phase AC voltage controller (phase control)  
`Vm`, `f`, `R`, `L`, `alpha`

**`acvc-3ph`** – Three-phase AC voltage controller (star, resistive load)  
`Vm`, `R`, `alpha`

**`cyclo-1ph`** – Single-phase cycloconverter (1φ → 1φ, f_o = f_s / n)  
`Vm`, `fs`, `n`, `alpha`, `R`, `L`

**`cyclo-3ph`** – Three-phase cycloconverter (3φ → 1φ, 6-pulse groups)  
`Vm`, `fs`, `n`, `alpha`, `R`, `L`

**`dual-1ph`** – Single-phase dual converter and circulating current  
`Vm`, `f`, `alpha`, `Lr`


### Inverters (DC → AC)

**`inv-1ph`** – Single-phase square-wave voltage source inverter (half bridge / full bridge)  
`topo` (half / full), `Vdc`, `f`, `R`, `L`, `dead`

**`inv-fourier`** – Fourier synthesis of the inverter output (square wave)  
`topo` (half / full), `Vdc`, `Nh`

**`inv-3ph`** – Three-phase bridge inverter (180° and 120° conduction)  
`cond` (180 / 120), `Vdc`, `f`, `R`, `L`

**`inv-pwm`** – Sinusoidal PWM inverter (comparator of m(t) and carrier c(t))  
`V`, `f1`, `mf`, `ma`, `noteSign` (true/false), `R`, `L`

**`inv-multilevel`** – Multilevel (cascaded-source) inverter, 2n+1 levels  
`n`, `Vdc`, `f`, `mode` (quant / equal)

**`inv-resonant`** – Resonant pulse inverters (series resonant, full-bridge resonant)  
`topo` (uni / bridge), `Vdc`, `R`, `L`, `C`, `fs`, `dead`


### Rectifiers (AC → DC)

**`rect-1ph-hw`** – Single-phase half-wave rectifier  
`Vm`, `f`, `dev` (thyristor / diode), `alpha`, `R`, `L`, `E`, `Vd`, `fwd` (true/false)

**`rect-1ph-fw`** – Single-phase full-wave bridge rectifier  
`Vm`, `f`, `dev` (thyristor / diode), `alpha`, `R`, `L`, `E`, `Vd`, `fwd` (true/false)

**`rect-3ph-hw`** – Three-phase half-wave (3-pulse) rectifier  
`Vm`, `f`, `dev` (thyristor / diode), `alpha`, `R`, `L`, `E`, `Vd`, `fwd` (true/false)

**`rect-3ph-fw`** – Three-phase full-wave (6-pulse) bridge rectifier  
`Vm`, `f`, `dev` (thyristor / diode), `alpha`, `R`, `L`, `E`, `Vd`, `fwd` (true/false)


### DC → DC converters

**`dcdc-buck`** – Buck (step-down) converter  
`Vs`, `D`, `f`, `L`, `C`, `R`

**`dcdc-boost`** – Boost (step-up) converter  
`Vs`, `D`, `f`, `L`, `C`, `R`

**`dcdc-buckboost`** – Buck-boost (inverting) converter  
`Vs`, `D`, `f`, `L`, `C`, `R`

**`dcdc-cuk`** – Ćuk converter  
`Vs`, `D`, `f`, `L`, `L2`, `C`, `C1`, `R`

**`dcdc-sepic`** – SEPIC (single-ended primary-inductor converter)  
`Vs`, `D`, `f`, `L`, `L2`, `C`, `C1`, `R`

**`dcdc-flyback`** – Flyback converter  
`Vs`, `D`, `f`, `L`, `n`, `C`, `R`


## 5. Not included

Sketches that are not defined by equations (device V-I characteristics of diode, BJT, MOSFET, IGBT, SCR, TRIAC), Class D and Class E commutation,
the current-source inverter with commutation capacitors, the induction-cooker discussion. If your rectifier chapter contains a case that is not listed above
(for example a semi-controlled bridge or the effect of source inductance), send me the page and I will add a model.

## 6. Assumptions and points to check against the note

* **Dual converter (note p.39).** The expression printed there, i_r = (2V_m/ωL_r)(cos α₁ − cos ωt), would give a peak of 4V_m/ωL_r at α = 0. Simulating the loop
  voltage v_r = v_o1 + v_o2 with α₂ = π − α₁ (as drawn on p.37) gives v_r ≡ 0 at α = 0 and a peak of (2V_m/ωL_r)(1 − cos α) for α ≤ 90°. The simulator shows both
  numbers; please check which one the course intends.
* **Class C commutation (note p.23).** The simulator reproduces the three current levels read from the note, V_s(1/R₁+1/R₂), V_s(2/R₁+1/R₂) and V_s(1/R₁+2/R₂), which confirms the transcription of p.23.
* **Cycloconverters.** Ideal, non-circulating operation; the negative group is modelled as the mirror image of the positive group (V_dc,n = −V_dc,p). The load current may reverse.
* **PWM.** By default m(t) > c(t) gives +V; tick *Comparator polarity of the note* for c(t) > m(t) ⇒ +V (the output is then the inverse of m(t)).
* **Class B.** Idealized analysis with the assumptions of the note (constant I_L, resonant half-cycle).
* The 120°-conduction inverter is simulated with a resistive load (one leg floats).

## 7. Tests

```
npm install      # only needed for the browser smoke test (jsdom)
npm test         # tests/run.mjs: ~80 numerical checks against closed-form results
                 # tests/dom.mjs: loads the real page and moves every parameter to its minimum / maximum
```

`tests/run.mjs` checks, among others: V_dc = V_m/π and V_rms = V_m/2 (half-wave), the full-bridge and three-phase formulas, the AC-controller formulas of p.40–41,
V_o1,rms = 0.45 V_DC / 0.9 V_DC, the 3-phase inverter line and phase voltages, buck / boost / buck-boost / flyback / Ćuk / SEPIC voltage ratios, ripple formulas,
DCM voltage formulas, P_in = P_out, and the worked SCR problems of p.29–30 (75 µs, 78 µs, 10 mA, 2.5 kΩ).

## 8. Files

```
index.html            page
css/style.css         layout, light / dark theme
js/util.js            statistics, Fourier analysis, formatting
js/plot.js            SVG renderer (stacked strips like the figures of the note, bar charts)
js/engines.js         numerical engines (rectifier, AC controllers, DC-DC)
js/modelkit.js        helpers shared by the models
js/models-*.js        the circuits, one file per chapter
js/aliases.js         figure id -> model + parameters (for the links from the PDF)
js/app.js             user interface
tests/                numerical and browser tests
.github/workflows/    GitHub Pages deployment
```
