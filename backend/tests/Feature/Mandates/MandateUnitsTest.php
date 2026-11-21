<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateUnit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->ajouter = fn ($mandat, array $corps) => $this->postJson(M::url($this->org, "/{$mandat->id}/units"), ['lock_version' => $mandat->lock_version, ...$corps]);
    $this->ligne = fn ($mandat, $lot): MandateUnit => M::dans($this->org, fn () => MandateUnit::query()->where('mandate_id', $mandat->id)->where('unit_id', $lot->id)->firstOrFail());
});

it('ajoute puis retire un lot d\'un brouillon', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);
    $annexe = M::lot($this->org);

    ($this->ajouter)($mandat, ['unit_id' => $annexe->id])->assertCreated()->assertJsonCount(2, 'data.units')->assertJsonPath('data.lock_version', 2);

    $ligne = ($this->ligne)($mandat, $annexe);
    $this->deleteJson(M::url($this->org, "/{$mandat->id}/units/{$ligne->id}"), ['lock_version' => 2])
        ->assertOk()->assertJsonCount(1, 'data.units')->assertJsonPath('data.lock_version', 3);
    expect(M::dans($this->org, fn () => MandateUnit::query()->where('mandate_id', $mandat->id)->count()))->toBe(1);
});

it('refuse le même lot deux fois, un lot d\'une autre organisation ou archivé, un début hors période', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);
    $autre = M::organisation();

    ($this->ajouter)($mandat, ['unit_id' => $this->lot->id])->assertConflict()->assertJsonPath('code', 'mandate_unit_conflict');
    ($this->ajouter)($mandat, ['unit_id' => M::lot($autre)->id])->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    ($this->ajouter)($mandat, ['unit_id' => M::lot($this->org)->id, 'valid_from' => '2029-01-01'])->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');

    $archive = M::lot($this->org);
    M::dans($this->org, fn () => $archive->forceFill(['archived_at' => now()])->save());
    ($this->ajouter)($mandat, ['unit_id' => $archive->id])->assertUnprocessable()->assertJsonPath('code', 'mandate_unit_not_available');
    expect(M::dans($this->org, fn () => MandateUnit::query()->where('mandate_id', $mandat->id)->count()))->toBe(1);
});

it('ajoute un lot à un mandat actif à partir d\'aujourd\'hui par défaut', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $annexe = M::lot($this->org);

    ($this->ajouter)($actif, ['unit_id' => $annexe->id])->assertCreated();

    expect(($this->ligne)($actif, $annexe)->valid_from->toDateString())->toBe('2026-11-16');
});

it('refuse d\'ajouter à un mandat actif un lot déjà couvert par un autre mandat', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $annexe = M::lot($this->org);
    M::actif($this->org, $annexe, M::partie($this->org));

    ($this->ajouter)($actif, ['unit_id' => $annexe->id])->assertConflict()->assertJsonPath('code', 'mandate_overlap');
    expect(M::dans($this->org, fn () => MandateUnit::query()->where('mandate_id', $actif->id)->count()))->toBe(1)
        ->and(M::relire($this->org, $actif)->lock_version)->toBe(1);
});

it('refuse d\'ajouter un lot à un mandat résilié ou expiré, et de retirer un lot d\'un mandat activé', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $ligne = ($this->ligne)($actif, $this->lot);

    $this->deleteJson(M::url($this->org, "/{$actif->id}/units/{$ligne->id}"), ['lock_version' => 1])->assertConflict()->assertJsonPath('code', 'mandate_not_draft');

    $termine = M::mandat($this->org, M::lot($this->org), $this->partie, [], MandateStatus::Terminated);
    ($this->ajouter)($termine, ['unit_id' => M::lot($this->org)->id])->assertConflict()->assertJsonPath('code', 'mandate_not_running');
});

it('met fin à la couverture d\'un lot d\'un mandat actif tout en gardant au moins un lot', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $annexe = M::lot($this->org);
    ($this->ajouter)($actif, ['unit_id' => $annexe->id, 'valid_from' => '2026-06-01'])->assertCreated();
    $ligne = ($this->ligne)($actif, $annexe);
    $fin = fn (MandateUnit $l, array $corps, int $version) => $this->postJson(M::url($this->org, "/{$actif->id}/units/{$l->id}/end"), ['lock_version' => $version, ...$corps]);

    $fin($ligne, ['end_date' => '2026-05-31'], 2)->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');
    $fin($ligne, ['end_date' => '2026-12-31'], 2)->assertOk()->assertJsonPath('data.lock_version', 3);

    expect(($this->ligne)($actif, $annexe)->valid_to?->toDateString())->toBe('2027-01-01');

    $principale = ($this->ligne)($actif, $this->lot);
    $fin($principale, ['end_date' => '2026-12-31'], 3)->assertConflict()->assertJsonPath('code', 'mandate_last_unit');
    $fin($ligne, ['end_date' => '2026-12-31'], 3)->assertUnprocessable();
    $this->postJson(M::url($this->org, "/{$actif->id}/units/".Str::uuid7().'/end'), ['lock_version' => 3, 'end_date' => '2026-12-31'])
        ->assertNotFound()->assertJsonPath('code', 'mandate_unit_not_found');
});

it('libère le lot pour un autre mandat après la fin de sa couverture', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $annexe = M::lot($this->org);
    ($this->ajouter)($actif, ['unit_id' => $annexe->id, 'valid_from' => '2026-11-16'])->assertCreated();
    $ligne = ($this->ligne)($actif, $annexe);
    $this->postJson(M::url($this->org, "/{$actif->id}/units/{$ligne->id}/end"), ['lock_version' => 2, 'end_date' => '2026-12-31'])->assertOk();

    $suivant = M::mandat($this->org, $annexe, M::partie($this->org), ['starts_on' => '2027-01-01', 'ends_on' => '2028-01-01']);
    $this->postJson(M::url($this->org, "/{$suivant->id}/activate"), ['signed_on' => '2026-11-10', 'lock_version' => 1])->assertOk();
});
