<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
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
});

it('crée un brouillon avec sa référence, ses lots et ses conditions initiales', function (): void {
    $reponse = $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, ['note' => 'Mandat famille Bernard']))
        ->assertCreated()
        ->assertJsonPath('data.reference', 'M-2026-0001')
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.mandant.id', $this->partie->id)
        ->assertJsonPath('data.mandate_type.semantic_key', 'rental_management')
        ->assertJsonPath('data.starts_on', '2026-12-01')
        ->assertJsonPath('data.end_date', '2027-11-30')
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.notice_months', 3)
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.units.0.unit.id', $this->lot->id)
        ->assertJsonPath('data.terms.fee_kind', 'percentage')
        ->assertJsonPath('data.terms.fee_basis_points', 700)
        ->assertJsonPath('data.terms.works_limit_amount', ['amount' => 50000, 'currency' => 'EUR'])
        ->assertJsonPath('data.note', 'Mandat famille Bernard');

    M::dans($this->org, function () use ($reponse): void {
        $mandat = Mandate::query()->findOrFail($reponse->json('data.id'));

        expect($mandat->ends_on->toDateString())->toBe('2027-12-01')
            ->and($mandat->created_by_user_id)->not->toBeNull()
            ->and(MandateUnit::query()->where('mandate_id', $mandat->id)->count())->toBe(1)
            ->and(MandateTerm::query()->where('mandate_id', $mandat->id)->count())->toBe(1)
            ->and(AuditLog::query()->where('subject_id', $mandat->id)->where('action', 'like', '%created%')->exists())->toBeTrue();
    });
});

it('numérote les mandats sans trou par organisation et par année', function (): void {
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie))->assertCreated()->assertJsonPath('data.reference', 'M-2026-0001');
    $autre = M::lot($this->org);
    $this->postJson(M::url($this->org), M::payload($autre, $this->partie))->assertCreated()->assertJsonPath('data.reference', 'M-2026-0002');

    $this->postJson(M::url($this->org), M::payload($autre, $this->partie, ['mandant_party_id' => 'pas-un-uuid']))->assertUnprocessable();
    $this->postJson(M::url($this->org), M::payload($autre, $this->partie))->assertCreated()->assertJsonPath('data.reference', 'M-2026-0003');

    $voisine = M::organisation();
    M::basculer($this, M::titulaire($voisine));
    $this->postJson(M::url($voisine), M::payload(M::lot($voisine), M::partie($voisine)))->assertCreated()->assertJsonPath('data.reference', 'M-2026-0001');
});

it('accepte des honoraires au forfait', function (): void {
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, [
        'terms' => ['fee_kind' => 'flat', 'fee_flat_amount' => 12000, 'payout_day' => 10, 'fee_base' => 'rent_and_charges'],
    ]))
        ->assertCreated()
        ->assertJsonPath('data.terms.fee_kind', 'flat')
        ->assertJsonPath('data.terms.fee_basis_points', null)
        ->assertJsonPath('data.terms.fee_flat_amount', ['amount' => 12000, 'currency' => 'EUR'])
        ->assertJsonPath('data.terms.works_limit_amount', ['amount' => 0, 'currency' => 'EUR']);
});

it('refuse des honoraires incohérents : taux et forfait ensemble, taux manquant, taux au-dessus de 100 %', function (array $terms): void {
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, ['terms' => $terms]))
        ->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(0);
})->with([
    'taux et forfait' => [['fee_kind' => 'percentage', 'fee_basis_points' => 700, 'fee_flat_amount' => 100, 'payout_day' => 5]],
    'taux manquant' => [['fee_kind' => 'percentage', 'payout_day' => 5]],
    'forfait manquant' => [['fee_kind' => 'flat', 'payout_day' => 5]],
    'taux trop haut' => [['fee_kind' => 'percentage', 'fee_basis_points' => 10001, 'payout_day' => 5]],
    'montant négatif' => [['fee_kind' => 'flat', 'fee_flat_amount' => -1, 'payout_day' => 5]],
    'jour de reversement hors 1-28' => [['fee_kind' => 'percentage', 'fee_basis_points' => 700, 'payout_day' => 29]],
]);

it('refuse des entrées invalides sans rien écrire', function (string $champ, mixed $valeur): void {
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, [$champ => $valeur]))
        ->assertUnprocessable()->assertJsonValidationErrors($champ);
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(0);
})->with([
    'fin avant début' => ['end_date', '2026-11-30'],
    'devise inconnue' => ['currency', 'ZZZ'],
    'devise en minuscules' => ['currency', 'eur'],
    'sans lot' => ['units', []],
    'durée de reconduction nulle' => ['renewal_months', 0],
    'préavis trop long' => ['notice_months', 25],
]);

it('ne laisse pas le client fixer l\'organisation, le statut ni la référence', function (): void {
    $autre = M::organisation();

    $reponse = $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, [
        'organization_id' => $autre->id, 'status' => 'active', 'reference' => 'M-1999-0001', 'lock_version' => 9,
    ]))->assertCreated();

    expect($reponse->json('data.status'))->toBe('draft')
        ->and($reponse->json('data.reference'))->toBe('M-2026-0001')
        ->and($reponse->json('data.lock_version'))->toBe(1)
        ->and(M::dans($autre, fn () => Mandate::query()->count()))->toBe(0);
});

it('refuse un mandant, un lot ou un type qui n\'appartient pas à l\'organisation', function (): void {
    $autre = M::organisation();

    $this->postJson(M::url($this->org), M::payload($this->lot, M::partie($autre)))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $this->postJson(M::url($this->org), M::payload(M::lot($autre), $this->partie))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, ['mandate_type_term_id' => M::terme('unit_type', 'house')->id]))
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(0);
});

it('refuse un mandant anonymisé et un lot archivé', function (): void {
    M::dans($this->org, fn () => $this->partie->forceFill(['anonymized_at' => now()])->save());
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie))->assertUnprocessable()->assertJsonPath('code', 'mandate_party_not_available');

    $vivante = M::partie($this->org);
    M::dans($this->org, fn () => $this->lot->forceFill(['archived_at' => now()])->save());
    $this->postJson(M::url($this->org), M::payload($this->lot, $vivante))->assertUnprocessable()->assertJsonPath('code', 'mandate_unit_not_available');
});

it('refuse deux fois le même lot ou un lot qui commence hors de la période', function (): void {
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, ['units' => [['unit_id' => $this->lot->id], ['unit_id' => $this->lot->id]]]))
        ->assertUnprocessable()->assertJsonValidationErrors('units.0.unit_id');
    $this->postJson(M::url($this->org), M::payload($this->lot, $this->partie, ['units' => [['unit_id' => $this->lot->id, 'valid_from' => '2028-01-01']]]))
        ->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');
    expect(M::dans($this->org, fn () => Mandate::query()->count()))->toBe(0);
});
