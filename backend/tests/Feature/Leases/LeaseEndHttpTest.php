<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));

    $this->url = fn (string $action, Lease|string $bail): string => "/api/v1/org/{$this->org->id}/leases/".($bail instanceof Lease ? $bail->id : $bail)."/{$action}";
});

it('enregistre le préavis par HTTP, auteur journalisé, et renvoie le bail', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(($this->url)('notice', $bail), [
        'lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation professionnelle',
    ])->assertOk()
        ->assertJsonPath('data.notice.departure_on', '2027-02-10')
        ->assertJsonPath('data.notice.given_by', 'tenant');

    expect(AuditLog::query()->where('action', 'leases.lease.notice_recorded')->firstOrFail()->actor_user_id)->toBe($this->titulaire->id);
});

it('répond 409 au second préavis sans replace puis 200 avec replace', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);
    $corps = ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation'];

    $this->postJson(($this->url)('notice', $bail), $corps)->assertOk();
    $this->postJson(($this->url)('notice', $bail), [...$corps, 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'lease_notice_exists');
    $this->postJson(($this->url)('notice', $bail), [...$corps, 'lock_version' => 2, 'replace' => true])->assertOk();
});

it('valide les entrées du préavis', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(($this->url)('notice', $bail), [
        'lock_version' => 1, 'notice_given_by' => 'autre', 'notice_received_on' => '2026-11-17', 'notice_departure_on' => '2026-11-01',
    ])->assertUnprocessable()->assertJsonValidationErrors(['notice_given_by', 'notice_received_on', 'notice_departure_on', 'termination_reason']);
});

it('résilie par HTTP, motif exigé pour une résiliation amiable', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(($this->url)('terminate', $bail), ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true])
        ->assertUnprocessable()->assertJsonValidationErrors(['termination_reason']);

    $this->postJson(($this->url)('terminate', $bail), ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true, 'termination_reason' => 'Accord des parties', 'requested_by' => 'tenant'])
        ->assertOk()->assertJsonPath('data.status', 'terminated');

    $this->postJson(($this->url)('terminate', $bail), ['lock_version' => 2, 'ends_on' => '2027-01-31', 'amicable' => true, 'termination_reason' => 'Accord des parties', 'requested_by' => 'tenant'])
        ->assertConflict()->assertJsonPath('code', 'lease_already_terminated');
});

it('renouvelle par HTTP et révise le loyer', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['starts_on' => '2023-11-16', 'ends_on' => '2026-11-16']);
    $this->actingAs($this->titulaire);

    $this->postJson(($this->url)('renew', $bail), [
        'lock_version' => 1, 'duration_months' => 36,
        'changes' => [['component_term_id' => L::composante('rent')->id, 'amount' => 66500]],
    ])->assertOk()->assertJsonPath('data.end_date', '2029-11-15');

    expect(AuditLog::query()->where('action', 'leases.lease.renewed')->firstOrFail()->actor_user_id)->toBe($this->titulaire->id);
});

it('refuse sans jeton, sans droit d\'écriture et hors de l\'organisation', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $corps = ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true, 'termination_reason' => 'Accord', 'requested_by' => 'tenant'];

    foreach (['notice', 'terminate', 'renew'] as $action) {
        auth()->forgetGuards();
        $this->postJson(($this->url)($action, $bail), $corps)->assertUnauthorized();

        R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));
        $this->postJson(($this->url)($action, $bail), $corps)->assertForbidden();

        R::changerDeCompte($this, L::titulaire(L::organisation()));
        $this->postJson(($this->url)($action, $bail), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    $autre = L::organisation();
    ['bail' => $etranger] = E::bail($autre);
    R::changerDeCompte($this, $this->titulaire);
    $this->postJson(($this->url)('terminate', $etranger), $corps)->assertNotFound()->assertJsonPath('code', 'lease_not_found');

    expect(E::champs($this->org, $bail)['status'])->toBe('signed')
        ->and(E::champs($autre, $etranger)['status'])->toBe('signed');
});
