<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\MandateStatus;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->action = fn ($mandat, string $verbe, array $corps = []) => $this->postJson(M::url($this->org, "/{$mandat->id}/{$verbe}"), ['lock_version' => $mandat->lock_version, ...$corps]);
});

it('suspend puis reprend un mandat actif', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);

    ($this->action)($mandat, 'suspend')->assertOk()->assertJsonPath('data.status', 'suspended')->assertJsonPath('data.lock_version', 2);
    ($this->action)(M::relire($this->org, $mandat), 'suspend')->assertConflict()->assertJsonPath('code', 'mandate_not_active');
    ($this->action)(M::relire($this->org, $mandat), 'resume')->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.lock_version', 3);
    ($this->action)(M::relire($this->org, $mandat), 'resume')->assertConflict()->assertJsonPath('code', 'mandate_not_suspended');
});

it('refuse de suspendre un brouillon, de reprendre un mandat échu ou de suspendre sur une version périmée', function (): void {
    $brouillon = M::mandat($this->org, $this->lot, $this->partie);
    ($this->action)($brouillon, 'suspend')->assertConflict()->assertJsonPath('code', 'mandate_not_active');

    $actif = M::actif($this->org, M::lot($this->org), $this->partie);
    ($this->action)($actif, 'suspend', ['lock_version' => 9])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');

    $echu = M::mandat($this->org, M::lot($this->org), $this->partie, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01'], MandateStatus::Suspended);
    ($this->action)($echu, 'resume')->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');
});

it('résilie avec préavis : le mandat reste en vigueur jusqu\'au dernier jour et le lot ne se libère qu\'ensuite', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);

    ($this->action)($mandat, 'terminate', ['notice_given_on' => '2026-11-10', 'effective_on' => '2027-02-09', 'reason' => 'Vente du bien', 'note' => 'Accord oral'])
        ->assertOk()
        ->assertJsonPath('data.status', 'terminated')
        ->assertJsonPath('data.end_date', '2027-02-09')
        ->assertJsonPath('data.termination.notice_given_on', '2026-11-10')
        ->assertJsonPath('data.termination.effective_on', '2027-02-09')
        ->assertJsonPath('data.termination.reason', 'Vente du bien')
        ->assertJsonPath('data.termination.note', 'Accord oral');

    expect(M::dans($this->org, fn () => AuditLog::query()->where('subject_id', $mandat->id)->where('action', 'mandates.mandate.terminated')->count()))->toBe(1);

    $suivant = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2027-02-10', 'ends_on' => '2028-02-10']);
    $this->postJson(M::url($this->org, "/{$suivant->id}/activate"), ['signed_on' => '2026-11-10', 'lock_version' => 1])->assertOk();

    $trop_tot = M::mandat($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2027-02-09', 'ends_on' => '2028-02-10']);
    $this->postJson(M::url($this->org, "/{$trop_tot->id}/activate"), ['signed_on' => '2026-11-10', 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'mandate_overlap');
});

it('fait respecter le préavis contractuel sauf résiliation amiable', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);
    $corps = ['notice_given_on' => '2026-11-10', 'reason' => 'Fin de mission'];

    ($this->action)($mandat, 'terminate', [...$corps, 'effective_on' => '2027-02-08'])->assertUnprocessable()->assertJsonPath('code', 'mandate_termination_invalid');
    expect(M::relire($this->org, $mandat)->status)->toBe(MandateStatus::Active);

    ($this->action)($mandat, 'terminate', [...$corps, 'effective_on' => '2026-11-30', 'amicable' => true])->assertOk()->assertJsonPath('data.end_date', '2026-11-30');
});

it('refuse une résiliation incohérente : préavis futur, fin avant le préavis, prolongation du mandat, mandat non en cours', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);
    $base = ['reason' => 'Motif', 'amicable' => true];

    ($this->action)($mandat, 'terminate', [...$base, 'notice_given_on' => '2026-11-17', 'effective_on' => '2027-03-01'])->assertUnprocessable()->assertJsonValidationErrors('notice_given_on');
    ($this->action)($mandat, 'terminate', [...$base, 'notice_given_on' => '2026-11-10', 'effective_on' => '2026-11-09'])->assertUnprocessable()->assertJsonValidationErrors('effective_on');
    ($this->action)($mandat, 'terminate', [...$base, 'notice_given_on' => '2026-11-10', 'effective_on' => '2029-06-01'])->assertUnprocessable()->assertJsonPath('code', 'mandate_termination_invalid');
    ($this->action)($mandat, 'terminate', [...$base, 'notice_given_on' => '2026-11-10', 'effective_on' => '2027-03-01', 'reason' => ''])->assertUnprocessable()->assertJsonValidationErrors('reason');

    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie);
    ($this->action)($brouillon, 'terminate', [...$base, 'notice_given_on' => '2026-11-10', 'effective_on' => '2027-03-01'])->assertConflict()->assertJsonPath('code', 'mandate_not_running');
    expect(M::relire($this->org, $mandat)->status)->toBe(MandateStatus::Active);
});

it('renouvelle un mandat actif ou suspendu en prolongeant sa fin', function (): void {
    $mandat = M::actif($this->org, $this->lot, $this->partie);

    ($this->action)($mandat, 'renew', ['months' => 12])->assertOk()->assertJsonPath('data.end_date', '2029-12-31')->assertJsonPath('data.lock_version', 2);
    expect(M::dans($this->org, fn () => AuditLog::query()->where('subject_id', $mandat->id)->where('action', 'mandates.mandate.renewed')->count()))->toBe(1);

    ($this->action)(M::relire($this->org, $mandat), 'suspend')->assertOk();
    ($this->action)(M::relire($this->org, $mandat), 'renew', ['months' => 6])->assertOk()->assertJsonPath('data.end_date', '2030-06-30');
});

it('refuse le renouvellement d\'un brouillon, d\'un mandat résilié ou qui chevauche le mandat suivant', function (): void {
    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie);
    ($this->action)($brouillon, 'renew', ['months' => 12])->assertUnprocessable()->assertJsonPath('code', 'mandate_renewal_invalid');
    $resilie = M::mandat($this->org, M::lot($this->org), $this->partie, [], MandateStatus::Terminated);
    ($this->action)($resilie, 'renew', ['months' => 12])->assertUnprocessable()->assertJsonPath('code', 'mandate_renewal_invalid');

    $mandat = M::actif($this->org, $this->lot, $this->partie);
    M::actif($this->org, $this->lot, M::partie($this->org), ['starts_on' => '2029-01-01', 'ends_on' => '2031-01-01']);
    ($this->action)($mandat, 'renew', ['months' => 12])->assertConflict()->assertJsonPath('code', 'mandate_overlap');
    ($this->action)($mandat, 'renew', ['months' => 0])->assertUnprocessable()->assertJsonValidationErrors('months');
    expect(M::relire($this->org, $mandat)->ends_on->toDateString())->toBe('2029-01-01');
});

it('archive un mandat clos et le restaure, mais pas un mandat en cours', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);
    $this->postJson(M::url($this->org, "/{$actif->id}/archive"))->assertConflict()->assertJsonPath('code', 'mandate_not_archivable');

    $enPreavis = M::mandat($this->org, M::lot($this->org), $this->partie, ['ends_on' => '2027-01-01'], MandateStatus::Terminated);
    $this->postJson(M::url($this->org, "/{$enPreavis->id}/archive"))->assertConflict()->assertJsonPath('code', 'mandate_not_archivable');

    $clos = M::mandat($this->org, M::lot($this->org), $this->partie, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01'], MandateStatus::Terminated);
    $this->postJson(M::url($this->org, "/{$clos->id}/archive"))->assertOk()->assertJsonPath('data.archived_at', fn ($v) => $v !== null);
    $this->postJson(M::url($this->org, "/{$clos->id}/archive"))->assertOk();
    $this->deleteJson(M::url($this->org, "/{$clos->id}/archive"))->assertOk()->assertJsonPath('data.archived_at', null);

    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie);
    $this->postJson(M::url($this->org, "/{$brouillon->id}/archive"))->assertOk();
});
