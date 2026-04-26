import { useEffect, useState } from 'react'

function useTicker(interval) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), interval)
    return () => clearInterval(id)
  }, [interval])

  return tick
}

function normalizeAscii(source) {
  const lines = source.replace(/\r/g, '').split('\n')
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length)
  const minIndent = indents.length ? Math.min(...indents) : 0
  return lines.map((line) => line.slice(minIndent)).join('\n')
}

const heartBase = normalizeAscii(String.raw`
                                           .=:::-.    .-::-
                                  .:.     .= :-+=:    =.  =-: .-:.
                                :-  .=.   .- . =.:    :.     .+--
                                ::....-.   = ..=.:    .-    ::-...
                                 .=:- .=. .=--..=-    .-   --- .
                         :-:::::--==:.:--.  .==:-=    :-:..:-
                        .-  ....--:.--      .::::--  .+: ..-.
                         -=====-:.=:        .:::.=::.=::..::....
                                .-.=.       .::: .+:....... ..:=.
                                -:-.        .-= ..              .-.------.
                               -::-       .:-:               .--.     .-::
                              .:=--.     .= .         ..=+=--.      ..:.::
                              ==-=.     ::           ..+=:.         :.= =.
                             .=-+:      =.        ::=-...         :.::==.
                             --:+-::.  -:    =   .+=:         .:--=*=-:..--.
                             -=+:   ::..-   .=...--+         =.----===-.  .-
                           .=........=: =   .-    =*        .-= ... .*:+-.-+
                         .=.          ..=   .- .:-=.   ..   ===.     .+-...
                        .:                .:-=+--:    -. ...-+.       .=...=
                        -. ..          .: ..-.   .  .:+=-..-=.         =:::=
                        =.....        .-....==    .=.. ...-=.         ==...  .
                      ..-..............-.. ..=-:.=:....:==:....:.. ..:::-.....
                      ..-.............::......:===+==---+:::-:-: ...-=:.-. ..
                      ..=............=...........=.. ...=:.....-:..=:::=......
                       .+:.       .=::        .. =.-. ..:=     .::  ..:=:
                        -==     .=. .--          .      :+      ::    .==.
                        .-==  .-: ..=.                  :+      .-:   .=-.
                        ..==---.   -.                   :-:     ..=   .=-.
                           :--+                         --:     ..-   :--
                            ::                         -=:=..   ..   .::
                             -:           -:::::-..:==+=. .-.        .=
                              -.            .---..  .=-.   :-        =
                              .-           --      :=:      ==.     ==
                               .=                 .-=       -.=.  .=::
                                .-                .*.       ::..-*-=:
                                 :-               .*.        :.--:-.
                                  ::              .-=          :+- ..
                                   .=.         .-==:=        .+=..
                                    .-:       -. :=-.      -=-..
                                      .=.    :.  =-:.:-   :=. ..
                                        .-=-=. :-:....   :- .
                                          .=---:-       ::
                                            .==+*.    .=.
                                               .::::::.
`)

const heartAlertArt = normalizeAscii(String.raw`
.########################.
#######++++##############|
#######.##.##############|
#######.##.##############|
#######.##.##############|
#######.##.##############|
#######....##############|
#######++++##############|
'########################'
`)

const hostileRouteArt = normalizeAscii(String.raw`
     .-^^^^^^^^^^^^^^^^-.
   ./####################\.
  /##########!!###########\
 |###########!!############|
 |###########!!############|
 |###########!!############|
 |###########..############|
  \########################/
   '----------------------'
`)

function heartFrame(frame) {
  if (frame === 0) return heartBase
  if (frame === 1) return heartBase.replaceAll(' .', '  ').replaceAll('=.', '==')
  return heartBase.replaceAll(' .', ' ').replaceAll(':-', '::')
}

export function AsciiHeart({ isAttack, bpm, attackType }) {
  const tick = useTicker(isAttack ? 420 : 900)
  const frame = heartFrame(tick % 3)

  return (
    <div className="ascii-block heart-shell">
      <div className="ascii-label">BEATING CORE / ASCII HEART</div>
      <div className="heart-stage">
        <pre className="ascii heart-red centered-heart">{frame}</pre>
        {isAttack && (
          <div className={`heart-alert-pop alert-step-${tick % 3}`}>
            <pre className="ascii heart-alert-ascii">{heartAlertArt}</pre>
            <div className="heart-alert-copy">
              <div className="heart-alert-kicker">ATTACK DETECTED</div>
              <div className="heart-alert-title">{attackType && attackType !== 'NONE' ? `${attackType} signature latched` : 'Telemetry divergence rising'}</div>
            </div>
          </div>
        )}
      </div>
      <div className="ascii-meta">
        <span>{isAttack ? 'EXCLAMATORY RESPONSE / THREAT DETECTED' : 'SYNCHRONIZED PERFUSION'}</span>
        <span>{Number(bpm || 78).toFixed(0)} BPM</span>
      </div>
    </div>
  )
}

export function AsciiPump({ dose, isAttack, offline, attackType }) {
  const tick = useTicker(320)
  const boundedDose = Math.max(0, Number(dose || 0))
  const chamberFill = offline ? 0 : Math.max(2, Math.round(Math.min(1, boundedDose / 16.5) * 18))
  const plungerFill = '='.repeat(Math.max(4, 10 - Math.floor(chamberFill / 3))).padEnd(10, ' ')
  const fluidFill = '~'.repeat(chamberFill).padEnd(18, '.')
  const drip = offline ? 'x' : ['.', 'o', 'O', 'o'][tick % 4]

  return (
    <div className={`ascii-block pump-shell ${isAttack ? 'attack' : ''} ${offline ? 'offline' : ''}`}>
      <div className="ascii-label">SYRINGE DELIVERY</div>
      <div className="ascii syringe-body">
        <div className="ascii-line"><span className="syringe-metal">        _________________________________________________</span></div>
        <div className="ascii-line">
          <span className="syringe-metal">  _____/_____/</span>
          <span className="syringe-glass">__________________________________________</span>
          <span className="syringe-metal">\____</span>
        </div>
        <div className="ascii-line">
          <span className="syringe-metal"> |====|</span>
          <span className="syringe-plunger">{plungerFill}</span>
          <span className="syringe-metal">|</span>
          <span className="syringe-fluid">{fluidFill}</span>
          <span className="syringe-metal">|==[TONIC]==|&gt;&gt;&gt;\</span>
        </div>
        <div className="ascii-line">
          <span className="syringe-metal"> |____|_____|</span>
          <span className="syringe-glass">__________________________________________</span>
          <span className="syringe-metal">|___/</span>
        </div>
        <div className="ascii-line">
          <span className="syringe-metal">              \_____________________________________/   </span>
          <span className="syringe-fluid syringe-drip">{drip}</span>
        </div>
        <div className="ascii-line"><span className="syringe-caption">plunger drive              tonic-blue chamber                needle</span></div>
      </div>
      <div className="ascii-meta">
        <span>
          {offline
            ? 'QUARANTINED / FLOW HARD-STOP'
            : isAttack
              ? `${attackType || 'ATTACK'} / FLOW UNDER SCRUTINY`
              : 'TONIC BLUE DELIVERY'}
        </span>
        <span>{boundedDose.toFixed(2)} U/hr</span>
      </div>
    </div>
  )
}

export function AsciiArchitecture({ reading, pulse, flash }) {
  const tick = useTicker(340)
  const marker = ['>', '>>', '>>>'][tick % 3]
  const attackActive = reading?.is_attack || flash > 0
  const alarm = attackActive ? ['[ALERT!]', '[!ALERT]', '[!!ALERT!!]'][tick % 3] : '[CLEAR]'
  const left = reading?.source === 'compromised' ? '[ATTACKER]' : '[CARE GATE]'
  const hex = reading?.hex_payload || '0x00000000'
  const decoded = `${Number(reading?.translated_value || 0).toFixed(3)} ${reading?.unit || ''}`.trim()

  const deviceKey = reading?.device_key || 'NONE'
  const displayKey = deviceKey !== 'NONE' ? `0x${deviceKey.slice(0, 6)}...${deviceKey.slice(-6)}` : 'DROPPED'
  const sig = reading?.signature || 'NO_KEY'
  const displaySig = sig !== 'NO_KEY' ? `0x${sig.slice(0, 6)}...${sig.slice(-6)}` : 'INVALID'

  return (
    <div className="ascii-block route-shell">
      <div className="ascii-label">VISIBLE ARCHITECTURE</div>
      <pre className={`ascii ${attackActive ? 'danger' : 'safe'}`}>
{`${left} ${marker} [HEX ${hex}] ${marker} [TRANSLATOR]
          |    [KEY ${displayKey.padEnd(18)}]    |
          |    [SIG ${displaySig.padEnd(18)}]    +--> ${alarm}
          |                     +--> [PLAYBOOK ${reading?.playbook_name || 'NONE'}]
          v
      [DECODED ${decoded}]
          |
          +--> [FINGERPRINT ${reading?.attack_type || 'NONE'}]
          |
          +--> [SAFETY GATE ${reading?.severity || 'INFO'}]
          |
          +--> [DOSAGE ${Number(reading?.dose_delivered || 0).toFixed(3)}]

${reading?.route || 'EMR -> CARE GATEWAY -> HEX TRANSLATOR -> SAFETY GATE -> PUMP'}`}
      </pre>
      <div className="route-detail">
        {attackActive ? (
          <>
            <pre className="ascii hostile-route-ascii">{hostileRouteArt}</pre>
            <div>{reading?.fingerprint}</div>
          </>
        ) : (
          <div>Noise profile and routing look nominal across the current window.</div>
        )}
      </div>
      <div className="ascii-meta">
        <span>{reading?.source === 'compromised' ? 'COMPROMISED ORIGIN' : 'LEGITIMATE ORIGIN'}</span>
        <span>PULSE {pulse}</span>
      </div>
    </div>
  )
}

export function AsciiTranslator({ reading, mitigation, sensor }) {
  if (!reading) {
    return <div className="panel translator-panel">Awaiting telemetry...</div>
  }

  return (
    <div className="panel translator-panel">
      <div className="panel-title">Hex Translation Visible</div>
      <pre className={`translator-lines ${reading.is_attack ? 'danger' : 'safe'}`}>
{`rx.hex        ${reading.hex_payload}
ieee754.float  ${Number(reading.translated_value).toFixed(3)} ${reading.unit}
register       ${reading.register}
dose.command   ${Number(reading.dose_delivered || 0).toFixed(3)} U/hr
playbook       ${reading.playbook_name || 'NONE'}
attack.type    ${reading.attack_type || 'NONE'}
origin         ${reading.source.toUpperCase()}
quarantine     ${sensor?.quarantined ? 'LATCHED' : 'CLEAR'}
mitigation     ${mitigation}
`}
      </pre>
      <div className="telemetry-note inline">
        {reading.fingerprint}
      </div>
    </div>
  )
}

export function SensorTerminal({ sensor, isActive, onSelect, onAttack, onRelease }) {
  const reading = sensor.latest
  const dose = reading?.dose_delivered ?? 0
  const statusText = sensor.quarantined ? 'Quarantined' : sensor.status

  return (
    <div
      role="button"
      tabIndex={0}
      className={`sensor-terminal ${isActive ? 'active' : ''} ${sensor.quarantined ? 'offline' : ''}`}
      onClick={() => onSelect(sensor.device_id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(sensor.device_id)
      }}
    >
      <pre className="sensor-ascii">
{String.raw`
 .-----------------------------------.
 | ${sensor.name.padEnd(31, ' ')} |
 | ${sensor.device_id.padEnd(31, ' ')} |
 | status: ${statusText.padEnd(24, ' ')} |
 | dose  : ${String(dose.toFixed(2)).padEnd(24, ' ')} |
 | risk  : ${String(`${sensor.risk_score}/100`).padEnd(24, ' ')} |
 '-----------------------------------'
`}
      </pre>
      <div className="sensor-hover">
        <div>{sensor.name}</div>
        <div>Uptime: {sensor.uptime}</div>
        <div>Location: {sensor.location}</div>
        <div>Latest dose: {dose.toFixed(2)}</div>
        <div>Fingerprint: {reading?.attack_type || 'NONE'}</div>
      </div>
      <div className="sensor-actions">
        <span>{sensor.device_type.replaceAll('_', ' ')}</span>
        {sensor.quarantined ? (
          <button
            type="button"
            className="mini-restart"
            onClick={(event) => {
              event.stopPropagation()
              onRelease(sensor.device_id)
            }}
          >
            Release
          </button>
        ) : (
          <button
            type="button"
            className="mini-attack"
            onClick={(event) => {
              event.stopPropagation()
              onAttack(sensor.device_id, 'COMMAND_INJECTION')
            }}
          >
            Inject attack
          </button>
        )}
      </div>
    </div>
  )
}


const patientFrame0 = normalizeAscii(String.raw`
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                  @@@                                                                               
                  @ @        @@@@@@                                                                 
                  @ @      @@      @@                                                               
                  @ @      @        -@                                                              
                  @ @   #@@@         @ @@@@@=                                                       
                  @ @    @  @@*    @@@@      @@@                                                    
                  @ @@@-@@@@   @@@@ @           #@@@                           @@ @ @ @             
                  @ @@     @@@@    @    @            @@@@@@@@@:@@@@@  @@@@@@+ @@@ @ @ @             
                  @ @@ @@     @@@@@@@    @@          @ @@@%          @@@@@%   @@  @ @ @             
                  @ @ @@@ @@     @@@ @@     @@@@@@@@@@@@                   -@@   @. @ @             
                  @ @    @@@ @@:    @@@@@                @  +@@@@@@@@           #@  @ @             
                  @ @       @@@ @@@     @@@              @@           @@@@@@    @   @ @             
                  @ @@@@@@@@@@@@@@ @@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @ @@          @ @@@ @@@ -@                                       @@ @             
                  @ @@#:.:::::=@@    %@@ @@@@=------===--============-----:::::::: @@ @             
                  @ @                                                               @ @             
                  @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @@@           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@         @@@             
                                        @@ @@   @ .       @   @@ @@                                 
                                      @@ @@     @@@     @@@     @@ @@                               
                                @@@ @@ @@                         @@ @@ @@@                         
                                @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @                         
                               .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                        
                             @@@@@@@                                   @ @@.@                       
                             @ @ @*@                                   @@@ @@@                      
                              @@@@@                                    @@@@@@                       
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    

`)

const patientFrame1 = normalizeAscii(String.raw`
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                  @@@                                                                               
                  @ @        @@@@@@                                                                 
                  @ @      @@      @@                                                               
                  @ @      @        -@                                                              
                  @ @   #@@@         @ @@@@@=                                                       
                  @ @    @  @@*    @@@@      @@@                                                    
                  @ @@@-@@@@   @@@@ @           #@@@                           @@ @ @ @             
                  @ @@     @@@@    @    @            @@@@@@@@@:@@@@@  @@@@@@+ @@@ @ @ @             
                  @ @@ @@     @@@@@@@    @@          @ @@@%          @@@@@%   @@  @ @ @             
                  @ @ @@@ @@     @@@ @@      @@@@@@@@@@@@                  -@@   @. @ @             
                  @ @    @@@ @@:    @@@@@                 @  +@@@@@@@@          #@  @ @             
                  @ @       @@@ @@@     @@@              @@           @@@@@@    @   @ @             
                  @ @@@@@@@@@@@@@@ @@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @ @@          @ @@@ @@@ -@                                       @@ @             
                  @ @@#:.:::::=@@    %@@ @@@@=------===--============-----:::::::: @@ @             
                  @ @                                                               @ @             
                  @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @@@           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@         @@@             
                                        @@ @@   @ .       @   @@ @@                                 
                                      @@ @@     @@@     @@@     @@ @@                               
                                @@@ @@ @@                         @@ @@ @@@                         
                                @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @                         
                               .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                        
                             @@@@@@@                                   @ @@.@                       
                             @ @ @*@                                   @@@ @@@                      
                              @@@@@                                    @@@@@@                       
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    

`)

const patientFrame2 = normalizeAscii(String.raw`
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                  @@@                                                                               
                  @ @        @@@@@@                                                                 
                  @ @      @@      @@                                                               
                  @ @      @        -@                                                              
                  @ @   #@@@         @ @@@@@=                                                       
                  @ @    @  @@*    @@@@      @@@                                                    
                  @ @@@-@@@@   @@@@ @           #@@@                           @@ @ @ @             
                  @ @@     @@@@    @    @            @@@@@@@@@:@@@@@  @@@@@@+ @@@ @ @ @             
                  @ @@ @@     @@@@@@@    @@          @ @@@%          @@@@@%   @@  @ @ @             
                  @ @ @@@ @@     @@@ @@       @@@@@@@@@@@@                 -@@   @. @ @             
                  @ @    @@@ @@:    @@@@@                  @  +@@@@@@@@         #@  @ @             
                  @ @       @@@ @@@     @@@              @@           @@@@@@    @   @ @             
                  @ @@@@@@@@@@@@@@ @@@     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @ @@          @ @@@ @@@ -@                                       @@ @             
                  @ @@#:.:::::=@@    %@@ @@@@=------===--============-----:::::::: @@ @             
                  @ @                                                               @ @             
                  @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @             
                  @@@           @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@         @@@             
                                        @@ @@   @ .       @   @@ @@                                 
                                      @@ @@     @@@     @@@     @@ @@                               
                                @@@ @@ @@                         @@ @@ @@@                         
                                @ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @                         
                               .@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                        
                             @@@@@@@                                   @ @@.@                       
                             @ @ @*@                                   @@@ @@@                      
                              @@@@@                                    @@@@@@                       
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    

`)

const exclArt = normalizeAscii(String.raw`
                                                                                                   +
                                                                      ++                          --
                                                                      ..                         +--
                                                                      ..        --               +--
                                                                      ..       -.+                +-
                                                                      ..      --                    
                                                                      ..     --                     
                                                                      -.    -.        +..           
                              ++++++++++++++++++++++++++++++++++++++++     +-      +..-+            
                         +...........................................--.--+     +-.-+               
                       +..-                                              -..+  ..+                  
                      +..                                                  ..+                      
                      ..+                       ..#.                        ..  +...........        
                     +.-                       +....+                       -.+                     
                     +.-                       +....+                       -.+                     
                     +.-                        ....                        -.+                     
                     +.-                        ..#.                        -.+                     
                     +.-                        ....                        -.+                     
                     +.-                        -...                        -.+                     
                     +.-                        +..+                        -.+                     
                     +.-                                                    -.+                     
                      --                         ++                         -.+                     
                     +.-                       +....+                       -.+                     
        +..........+  ..+                       -..-                        ..                      
                      +..                                                  ..+                      
                  +..  +..-                                              -..+                       
                ...+      .....-           +...............--.............+                         
             -#.+      .-     +..         ...                                                       
           -.-        .-    .-  -.+      ..-                                                        
                    +.-     .-   -.-   +..                                                          
                   +.-      .-    -.. -.-                                                           
                  +.-       .-     +...-                                                            
                  ++        .-       -+                                                             
                            .-                                                                      
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    
                                                                                                    

`)

function patientFrame(tick) {
  if (tick % 4 === 0) return patientFrame0;
  if (tick % 4 === 1) return patientFrame1;
  if (tick % 4 === 2) return patientFrame2;
  return patientFrame1;
}

export function AsciiPatient({ isAttack }) {
  const tick = useTicker(700);
  const frame = patientFrame(tick);

  return (
    <div className="patient-center-container">
      <pre className={`patient-ascii ${isAttack ? 'danger' : 'safe'}`}>{frame}</pre>
      {isAttack && (
        <div className="patient-alert-bubble">
          <pre className="patient-excl-ascii">{exclArt}</pre>
        </div>
      )}
    </div>
  )
}

export function AsciiPipeline({ direction, isAttack, side }) {
  const tick = useTicker(300);
  const arrow = direction === 'right' ? '>' : '<';
  const pipeline = [
    ` ${arrow}   `,
    ` ${arrow}${arrow}  `,
    ` ${arrow}${arrow}${arrow} `
  ][tick % 3];

  let art = '';
  if (side === 'left') {
    art = `
   +-------------${pipeline}
   |
---+-------------${pipeline}
   |
   +-------------${pipeline}
`;
  } else {
    art = `
  ${pipeline}-------------+
                  |
  ${pipeline}-------------+
`;
  }

  return (
    <div className="pipeline-stage">
      <pre className={`pipeline-ascii ${isAttack ? 'danger' : 'safe'}`}>
        {art}
      </pre>
    </div>
  )
}
