<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Shared\Audit\AuditLog;
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
    $this->activer = fn ($mandat, array $corps = []) => $this->postJson(M::url($this->org, "/{$mandat->id}/activate"), ['signed_on' => '2026-11-10', 'lock_version' => $mandat->lock_version, ...$corps]);
});

it('active un brouillon signé et journalise l\'activation', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->activer)($mandat)
        ->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.signed_on', '2026-11-10')
        ->assertJsonPath('data.lock_version', 2);

    $relu = M::relire($this->org, $mandat);
    expect($relu->status)->toBe(MandateStatus::Active)
        ->and(M::dans($this->org, fn () => AuditLog::query()->where('subject_id', $mandat->id)->where('action', 'mandates.mandate.activated')->count()))->toBe(1);
});

it('refuse l\'activation d\'un mandat déjà activé, archivé, périmé ou sans lot', function (): void {
    $actif = M::actif($this->org, M::lot($this->org), $this->partie);
    ($this->activer)($actif)->assertConflict()->assertJsonPath('code', 'mandate_not_draft');

    $archive = M::mandat($this->org, M::lot($this->org), $this->partie, ['archived_at' => now()]);
    ($this->activer)($archive)->assertConflict()->assertJsonPath('code', 'mandate_archived');

    $perime = M::mandat($this->org, M::lot($this->org), $this->partie, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01']);
    ($this->activer)($perime)->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');

    $vide = M::mandat($this->org, M::lot($this->org), $this->partie);
    M::dans($this->org, fn () => $vide->units()->get()->each->delete());
    ($this->activer)($vide)->assertUnprocessable()->assertJsonPath('code', 'mandate_no_unit');
});

it('refuse une version périmée sans rien modifier', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->activer)($mandat, ['lock_version' => 7])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');

    expect(M::relire($this->org, $mandat)->status)->toBe(MandateStatus::Draft);
});

it('refuse une signature dans le futur ou un fichier signé inconnu', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->activer)($mandat, ['signed_on' => '2026-11-17'])->assertUnprocessable()->assertJsonValidationErrors('signed_on');
    ($this->activer)($mandat, ['signed_file_id' => (string) Str::uuid7()])->assertUnprocessable()->assertJsonPath('code', 'mandate_signature_invalid');
    expect(M::relire($this->org, $mandat)->status)->toBe(MandateStatus::Draft);
});

it('refuse l\'activation quand le mandant est anonymisé ou le lot archivé depuis la création', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);
    M::dans($this->org, fn () => $this->lot->forceFill(['archived_at' => now()])->save());
    ($this->activer)($mandat)->assertUnprocessable()->assertJsonPath('code', 'mandate_unit_not_available');

    $autre = M::mandat($this->org, M::lot($this->org), $vivante = M::partie($this->org));
    M::dans($this->org, fn () => $vivante->forceFill(['anonymized_at' => now()])->save());
    ($this->activer)($autre)->assertUnprocessable()->assertJsonPath('code', 'mandate_party_not_available');
});

it('refuse l\'activation d\'un second mandat sur un lot déjà couvert sur la période', function (string $debut, string $fin, int $statut): void {
    M::actif($this->org, $this->lot, $this->partie);
    $second = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => $debut, 'ends_on' => $fin]);

    $reponse = ($this->activer)($second)->assertStatus($statut);

    $statut === 409
        ? $reponse->assertJsonPath('code', 'mandate_overlap')
        : $reponse->assertJsonPath('data.status', 'active');
    expect(M::relire($this->org, $second)->status)->toBe($statut === 409 ? MandateStatus::Draft : MandateStatus::Active);
})->with([
    'recouvrement partiel' => ['2028-06-01', '2030-01-01', 409],
    'inclus dans le premier' => ['2026-12-01', '2027-06-01', 409],
    'englobe le premier' => ['2025-01-01', '2030-01-01', 409],
    'à la suite, sans trou ni recouvrement' => ['2029-01-01', '2031-01-01', 200],
]);

it('accepte un mandat qui s\'arrête la veille du début du mandat existant', function (): void {
    M::actif($this->org, $this->lot, $this->partie, ['starts_on' => '2027-01-01', 'ends_on' => '2029-01-01']);
    $avant = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2026-06-01', 'ends_on' => '2027-01-01']);
    $chevauche = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2026-06-01', 'ends_on' => '2027-01-02']);

    ($this->activer)($chevauche)->assertConflict()->assertJsonPath('code', 'mandate_overlap');
    ($this->activer)($avant)->assertOk()->assertJsonPath('data.status', 'active');
});

it('compte un mandat suspendu, résilié avec préavis ou expiré comme une couverture', function (MandateStatus $statut): void {
    M::mandat($this->org, $this->lot, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01'], $statut);
    $second = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2026-06-01', 'ends_on' => '2027-06-01']);

    ($this->activer)($second)->assertConflict()->assertJsonPath('code', 'mandate_overlap');
})->with([MandateStatus::Suspended, MandateStatus::Terminated, MandateStatus::Expired]);

it('ignore un autre brouillon et le mandat d\'une autre organisation sur le même lot', function (): void {
    M::mandat($this->org, $this->lot, $this->partie);
    $autre = M::organisation();
    M::actif($autre, M::lot($autre), M::partie($autre));
    $second = M::mandat($this->org, $this->lot, M::partie($this->org));

    ($this->activer)($second)->assertOk()->assertJsonPath('data.status', 'active');
});

it('active chaque lot d\'un mandat multi-lots sur ses propres périodes', function (): void {
    $annexe = M::lot($this->org);
    M::actif($this->org, $annexe, $this->partie, ['starts_on' => '2026-01-01', 'ends_on' => '2027-01-01']);
    $mandat = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    M::dans($this->org, fn () => $mandat->units()->create(['unit_id' => $annexe->id, 'valid_from' => '2027-01-01']));

    ($this->activer)($mandat)->assertOk();

    M::dans($this->org, fn () => $mandat->units()->where('unit_id', $annexe->id)->update(['valid_from' => '2026-06-01']));
    $deux = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2030-01-01', 'ends_on' => '2031-01-01']);
    M::dans($this->org, fn () => $deux->units()->create(['unit_id' => $annexe->id, 'valid_from' => '2030-01-01']));
    ($this->activer)($deux)->assertOk();
});
