<?php

declare(strict_types=1);

use Tests\Feature\Planning\PlanningContext as P;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->travelTo(now()->setDate(2026, 11, 21)->setTime(10, 0));
    config(['planning.max_active_series' => 2]);
    $this->org = C::organisation();
    $this->actingAs(C::titulaire($this->org));
    $this->serie = fn (array $corps = []) => $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence' => 'weekly', ...$corps]));
});

it('refuse une série récurrente au-delà du plafond de l\'organisation, sans toucher aux événements ponctuels', function (): void {
    ($this->serie)()->assertCreated();
    ($this->serie)(['recurrence_until' => '2027-12-31'])->assertCreated();

    ($this->serie)()->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
    $this->postJson(P::url($this->org, '/events'), P::evenement())->assertCreated();
    $this->postJson(P::url($this->org, '/events'), P::evenement(['recurrence' => 'weekly', 'starts_on' => '2026-01-05', 'recurrence_until' => '2026-02-01']))->assertCreated();
});

it('ne compte plus une série annulée ou terminée', function (): void {
    $premiere = ($this->serie)()->assertCreated()->json('data.id');
    ($this->serie)(['starts_on' => '2026-10-01', 'recurrence_until' => '2026-11-20', 'title' => 'Terminée hier'])->assertCreated();
    ($this->serie)()->assertCreated();
    ($this->serie)()->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');

    $this->postJson(P::url($this->org, "/events/{$premiere}/cancel"))->assertOk();
    ($this->serie)()->assertCreated();
    ($this->serie)()->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
});

it('compte une série qui prend fin aujourd\'hui, pas celle qui a pris fin hier', function (): void {
    ($this->serie)(['starts_on' => '2026-10-01', 'recurrence_until' => '2026-11-21'])->assertCreated();
    ($this->serie)(['starts_on' => '2026-10-01', 'recurrence_until' => '2026-11-21'])->assertCreated();

    ($this->serie)()->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
});

it('applique le plafond à la modification qui crée ou réactive une série, pas à une série déjà active', function (): void {
    $active = ($this->serie)()->assertCreated()->json('data');
    ($this->serie)()->assertCreated();
    $ponctuel = $this->postJson(P::url($this->org, '/events'), P::evenement())->assertCreated()->json('data');
    $terminee = ($this->serie)(['starts_on' => '2026-10-01', 'recurrence_until' => '2026-11-01'])->assertCreated()->json('data');

    $this->patchJson(P::url($this->org, "/events/{$active['id']}"), ['lock_version' => 1, 'title' => 'Renommée'])->assertOk();
    $this->patchJson(P::url($this->org, "/events/{$ponctuel['id']}"), ['lock_version' => 1, 'recurrence' => 'weekly'])->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
    $this->patchJson(P::url($this->org, "/events/{$terminee['id']}"), ['lock_version' => 1, 'recurrence_until' => null])->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
    $this->patchJson(P::url($this->org, "/events/{$terminee['id']}"), ['lock_version' => 1, 'recurrence_until' => '2026-11-10'])->assertOk();

    $this->postJson(P::url($this->org, "/events/{$active['id']}/cancel"))->assertOk();
    $this->patchJson(P::url($this->org, "/events/{$ponctuel['id']}"), ['lock_version' => 1, 'recurrence' => 'weekly'])->assertOk();
});

it('compte les séries organisation par organisation', function (): void {
    ($this->serie)()->assertCreated();
    ($this->serie)()->assertCreated();
    ($this->serie)()->assertUnprocessable();

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));
    $this->postJson(P::url($autre, '/events'), P::evenement(['recurrence' => 'weekly']))->assertCreated();
    $this->postJson(P::url($autre, '/events'), P::evenement(['recurrence' => 'weekly']))->assertCreated();
    $this->postJson(P::url($autre, '/events'), P::evenement(['recurrence' => 'weekly']))->assertUnprocessable()->assertJsonPath('code', 'planning_series_limit_reached');
});

it('garde le plafond à 200 séries par défaut', function (): void {
    expect(config('planning.max_active_series'))->toBe(2);
    $defaut = require base_path('config/planning.php');

    expect($defaut['max_active_series'])->toBe(200);
});
