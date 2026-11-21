<?php

declare(strict_types=1);

use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Actions\CancelInstallment;
use App\Modules\Rent\Actions\CancelPayment;
use App\Modules\Rent\Actions\GenerateInstallments;
use App\Modules\Rent\Actions\IssueNotice;
use App\Modules\Rent\Actions\IssueReceipt;
use App\Modules\Rent\Actions\RecordPayment;
use App\Modules\Rent\Data\NewPaymentData;
use App\Modules\Rent\Enums\PaymentMethod;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as Q;
use Tests\Feature\Rent\RentContext as C;

/*
 * Sous REPEATABLE READ (MySQL), la première lecture non verrouillante d'une transaction fige l'instantané : le reste dû,
 * lu après le verrou, ne verrait pas un encaissement validé entre-temps. Chaque Action qui décide d'une imputation ou
 * d'un statut prend donc, en tout premier dans sa transaction, la ligne `rent_schedules` du bail FOR UPDATE : deux
 * encaissements, ou un encaissement et une annulation, du même bail se suivent. La preuve réelle exige MySQL 8.4 à
 * deux connexions ; ici l'ordre des requêtes.
 */
beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail] = C::bail($this->org);
    $this->today = CarbonImmutable::parse(C::AUJOURDHUI)->startOfDay();
    $this->actingAs(L::titulaire($this->org));
    $this->verifier = function (callable $appel): void {
        $ordre = Q::run(fn () => L::dans($this->org, $appel));
        $debut = array_search(Q::BEGIN, array_map(fn (array $e): string => $e[0], $ordre), true);

        expect($debut)->not->toBeFalse();
        expect($ordre[$debut + 1][0])->toBe(Q::LOCKED_READ)
            ->and($ordre[$debut + 1][1])->toContain('"rent_schedules"');
    };
});

it('génération : le verrou de l\'échéancier précède toute lecture', function (): void {
    ($this->verifier)(fn () => app(GenerateInstallments::class)->handle(app(LeaseSchedule::class)->billing($this->bail->id), $this->today));
});

it('émission de l\'avis : le verrou précède la lecture de l\'échéance', function (): void {
    C::generer($this->org, $this->bail);
    [$echeance] = C::echeances($this->org, $this->bail);

    ($this->verifier)(fn () => app(IssueNotice::class)->handle($echeance, $this->today));
});

it('encaissement : le verrou précède la lecture des échéances ouvertes et du reste dû', function (): void {
    C::emises($this->org, $this->bail, $this);

    ($this->verifier)(fn () => app(RecordPayment::class)->handle(new NewPaymentData($this->bail->id, 1000, PaymentMethod::Transfer, '2026-11-16', null, null, 'cle-ordre-0001'), $this->today));
});

it('annulation d\'un encaissement : le verrou précède la lecture de l\'encaissement', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $paiement = L::dans($this->org, fn () => Payment::query()->firstOrFail());

    ($this->verifier)(fn () => app(CancelPayment::class)->handle($paiement, 'Erreur', $this->today));
});

it('annulation d\'une échéance : le verrou précède la lecture de l\'échéance', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);

    ($this->verifier)(fn () => app(CancelInstallment::class)->handle($echeance, 'Erreur', $this->today));
});

it('quittance : le verrou précède la lecture de l\'échéance', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000, ['method' => 'cheque'])->assertCreated();
    $echeance = L::dans($this->org, fn () => Installment::query()->firstOrFail());

    ($this->verifier)(fn () => app(IssueReceipt::class)->handle($echeance, $this->today));
});
