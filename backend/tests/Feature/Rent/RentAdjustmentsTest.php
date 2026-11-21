<?php

declare(strict_types=1);

use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentAdjustment;
use App\Modules\Rent\PublicApi\RentAdjustments;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

function ligneAjustement(int $position, int $montant, string $pasAvant, string $libelle = 'Régularisation des charges 2026'): AdjustmentLineData
{
    return new AdjustmentLineData($position, Money::EUR($montant), $libelle, CarbonImmutable::parse($pasAvant));
}

function programmerAjustement(object $org, string $bail, string $source, array $lignes): array
{
    return L::dans($org, fn (): array => app(RentAdjustments::class)->schedule($bail, $source, $lignes, null, null, CarbonImmutable::parse(C::AUJOURDHUI)));
}

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail] = C::bail($this->org);
    $this->source = (string) Str::uuid7();
    $this->actingAs(L::titulaire($this->org));
});

it('garde la ligne en attente jusqu\'à sa date, puis la facture sur la première échéance générée qui commence à cette date ou après', function (): void {
    $resultat = programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 8000, '2026-12-01')]);
    expect($resultat[0]->mode)->toBe('pending')->and($resultat[0]->installmentId)->toBeNull();

    C::generer($this->org, $this->bail, '2026-11-25');
    $echeances = C::echeances($this->org, $this->bail);
    $novembre = collect($echeances)->first(fn (Installment $e): bool => $e->period_start->toDateString() === '2026-11-01');
    $decembre = collect($echeances)->first(fn (Installment $e): bool => $e->period_start->toDateString() === '2026-12-01');

    $lignes = L::dans($this->org, fn () => DB::table('installment_lines')->where('semantic', 'charges_adjustment')->get());
    $ajustement = L::dans($this->org, fn () => RentAdjustment::query()->firstOrFail());

    expect($lignes)->toHaveCount(1)->and($lignes[0]->installment_id)->toBe($decembre->id)->and((int) $lignes[0]->amount)->toBe(8000)
        ->and($ajustement->status->value)->toBe('billed')->and($ajustement->installment_id)->toBe($decembre->id)
        ->and($decembre->charges_amount->getAmount())->toBe('13000')->and($novembre->charges_amount->getAmount())->toBe('5000')
        ->and($decembre->rent_amount->getAmount())->toBe('65000');
});

it('ne facture pas avant la date : une ligne plus lointaine reste en attente', function (): void {
    programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 8000, '2027-03-01')]);

    C::generer($this->org, $this->bail, '2026-11-25');

    expect(L::dans($this->org, fn () => DB::table('installment_lines')->where('semantic', 'charges_adjustment')->count()))->toBe(0)
        ->and(L::dans($this->org, fn () => RentAdjustment::query()->firstOrFail()->status->value))->toBe('pending');
});

it('ne facture qu\'une ligne par décompte et par échéance : les douzièmes se suivent mois après mois', function (): void {
    programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 1000, '2026-11-01'), ligneAjustement(2, 1000, '2026-11-01'), ligneAjustement(3, 1000, '2026-11-01')]);

    C::generer($this->org, $this->bail, '2026-11-25');

    $parEcheance = L::dans($this->org, fn () => DB::table('installment_lines')->where('semantic', 'charges_adjustment')->pluck('installment_id')->all());
    expect($parEcheance)->toHaveCount(2)->and(count(array_unique($parEcheance)))->toBe(2)
        ->and(L::dans($this->org, fn () => RentAdjustment::query()->where('status', 'pending')->count()))->toBe(1);
});

it('rejoue le même contenu sans doublon et refuse un contenu différent', function (): void {
    programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 8000, '2026-12-01')]);
    programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 8000, '2026-12-01')]);

    expect(L::dans($this->org, fn () => RentAdjustment::query()->count()))->toBe(1);

    foreach ([[ligneAjustement(1, 8001, '2026-12-01')], [ligneAjustement(1, 8000, '2027-01-01')], [ligneAjustement(1, 8000, '2026-12-01'), ligneAjustement(2, 1, '2026-12-01')]] as $autre) {
        try {
            programmerAjustement($this->org, $this->bail->id, $this->source, $autre);
            $this->fail('Un contenu différent doit être refusé.');
        } catch (ApiProblem $e) {
            expect($e->problemCode)->toBe('rent_adjustment_conflict')->and($e->status)->toBe(409);
        }
    }

    expect(L::dans($this->org, fn () => RentAdjustment::query()->count()))->toBe(1);
});

it('refuse une ligne nulle ou négative : un solde à rendre passe par le crédit', function (): void {
    expect(fn () => programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 0, '2026-12-01')]))->toThrow(ApiProblem::class);
    expect(L::dans($this->org, fn () => RentAdjustment::query()->count()))->toBe(0);
});

it('un bail terminé reçoit une échéance ponctuelle au lieu d\'une ligne en attente', function (): void {
    $org = $this->org;
    ['bail' => $termine] = C::bail($org, ['starts_on' => '2025-01-01', 'ends_on' => '2026-06-01', 'signed_on' => '2024-12-15']);

    $resultat = programmerAjustement($org, $termine->id, (string) Str::uuid7(), [ligneAjustement(1, 8000, '2026-12-16')]);

    $echeance = L::dans($org, fn () => Installment::query()->findOrFail($resultat[0]->installmentId));
    expect($resultat[0]->mode)->toBe('installment')->and($echeance->kind->value)->toBe('adjustment')->and($echeance->charges_amount->getAmount())->toBe('8000')
        ->and($echeance->rent_amount->getAmount())->toBe('0')
        ->and(L::dans($org, fn () => RentAdjustment::query()->where('lease_id', $termine->id)->firstOrFail()->status->value))->toBe('billed');
});

it('retire les lignes en attente, jamais celles déjà facturées', function (): void {
    programmerAjustement($this->org, $this->bail->id, $this->source, [ligneAjustement(1, 8000, '2027-03-01'), ligneAjustement(2, 8000, '2027-04-01')]);

    expect(L::dans($this->org, fn (): int => app(RentAdjustments::class)->cancelPending($this->bail->id, $this->source)))->toBe(2)
        ->and(L::dans($this->org, fn () => RentAdjustment::query()->where('status', 'cancelled')->count()))->toBe(2);

    $facturee = (string) Str::uuid7();
    programmerAjustement($this->org, $this->bail->id, $facturee, [ligneAjustement(1, 5000, '2026-11-01')]);
    C::generer($this->org, $this->bail, '2026-11-25');

    try {
        L::dans($this->org, fn () => app(RentAdjustments::class)->cancelPending($this->bail->id, $facturee));
        $this->fail('Une ligne facturée ne se retire pas.');
    } catch (ApiProblem $e) {
        expect($e->problemCode)->toBe('rent_adjustment_billed');
    }
});

it('le crédit d\'un solde négatif est une avance reprise par l\'avis suivant, rejouable une fois', function (): void {
    $api = fn (int $montant) => L::dans($this->org, fn () => app(RentAdjustments::class)->credit($this->bail->id, $this->source, Money::EUR($montant), null, null, CarbonImmutable::parse(C::AUJOURDHUI)));

    $premier = $api(5000);
    $rejeu = $api(5000);

    expect($premier->replayed)->toBeFalse()->and($rejeu->replayed)->toBeTrue()->and($rejeu->ledgerEntryId)->toBe($premier->ledgerEntryId)->and($rejeu->paymentId)->toBe($premier->paymentId)
        ->and(L::dans($this->org, fn () => DB::table('rent_payments')->where('method', 'charge_credit')->count()))->toBe(1)
        ->and(C::du($this->org, $this->bail))->toBe(-5000);

    expect(fn () => $api(6000))->toThrow(ApiProblem::class);

    C::emises($this->org, $this->bail, $this);

    expect(C::du($this->org, $this->bail))->toBe(65000)
        ->and(L::dans($this->org, fn () => DB::table('rent_payment_allocations')->sum('amount')))->toEqual(5000);
});
