Add-Type -AssemblyName System.Speech

$voices = @('Microsoft David Desktop', 'Microsoft Zira Desktop')
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

$lines = @(
    @{ Name = "launch_fox_two"; Text = "Fox two! Missile away!"; Rate = 1 },
    @{ Name = "launch_missile_away"; Text = "Missile launched! Tracking target."; Rate = 1 },
    @{ Name = "launch_firing"; Text = "Target locked, firing missile!"; Rate = 1 },
    @{ Name = "impact_direct_hit"; Text = "Direct hit! Target splashed!"; Rate = 1 },
    @{ Name = "impact_destroyed"; Text = "Target destroyed! Good hit!"; Rate = 1 },
    @{ Name = "impact_confirmed"; Text = "Impact confirmed! Hostile down!"; Rate = 1 }
)

foreach ($line in $lines) {
    # Voice 1: David (Tactical Male Commander)
    $synth.SelectVoice('Microsoft David Desktop')
    $synth.Rate = $line.Rate
    $outPath1 = "public/audio/$($line.Name)_david.wav"
    $synth.SetOutputToWaveFile($outPath1)
    $synth.Speak($line.Text)

    # Voice 2: Zira (Tactical Female Copilot / AI)
    $synth.SelectVoice('Microsoft Zira Desktop')
    $synth.Rate = $line.Rate
    $outPath2 = "public/audio/$($line.Name)_zira.wav"
    $synth.SetOutputToWaveFile($outPath2)
    $synth.Speak($line.Text)
}

$synth.Dispose()
Write-Host "Voice files generated successfully."
