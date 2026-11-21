<?php

declare(strict_types=1);

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Modules\Rent\Models\RentNotice;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail] = C::bail($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->mesure = fn (): array => L::dans($this->org, fn (): array => [
        JournalEntry::query()->count(), Payment::query()->count(), PaymentAllocation::query()->count(),
        RentNotice::query()->count(), IssuedDocument::query()->count(), StoredFile::query()->count(),
        Installment::query()->pluck('status', 'id')->map(fn ($s) => $s->value)->all(),
    ]);
    $this->echoue = function (string $modele, string $evenement): void {
        $modele::{$evenement}(function (): never {
            throw new RuntimeException('panne simulée');
        });
    };
});

afterEach(function (): void {
    Payment::flushEventListeners();
    PaymentAllocation::flushEventListeners();
    Installment::flushEventListeners();
});

it('un encaissement et son écriture comptable partagent une transaction : une panne après l\'écriture ne laisse rien', function (): void {
    C::emises($this->org, $this->bail, $this);
    $avant = ($this->mesure)();
    ($this->echoue)(PaymentAllocation::class, 'creating');

    $this->withoutExceptionHandling();
    expect(fn () => C::payer($this, $this->org, $this->bail, 70000))->toThrow(RuntimeException::class);

    expect(($this->mesure)())->toBe($avant)
        ->and(C::du($this->org, $this->bail))->toBe(70000);
});

it('l\'avis, sa pièce, son fichier et l\'appel de loyer partagent une transaction : une panne finale ne laisse rien', function (): void {
    C::generer($this->org, $this->bail);
    [$echeance] = C::echeances($this->org, $this->bail);
    $avant = ($this->mesure)();
    ($this->echoue)(Installment::class, 'updating');

    $this->withoutExceptionHandling();
    expect(fn () => $this->postJson(C::url($this->org, "/installments/{$echeance->id}/issue")))->toThrow(RuntimeException::class);

    expect(($this->mesure)())->toBe($avant)
        ->and(C::du($this->org, $this->bail))->toBe(0);
});

it('l\'annulation d\'un encaissement est atomique : une panne en cours laisse l\'encaissement intact', function (): void {
    C::emises($this->org, $this->bail, $this);
    $id = C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->json('data.id');
    $avant = ($this->mesure)();
    ($this->echoue)(Payment::class, 'updating');

    $this->withoutExceptionHandling();
    expect(fn () => $this->postJson(C::url($this->org, "/payments/{$id}/cancel"), ['reason' => 'Erreur']))->toThrow(RuntimeException::class);

    expect(($this->mesure)())->toBe($avant)
        ->and(C::du($this->org, $this->bail))->toBe(0);
});
