<?php

declare(strict_types=1);

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Money\Currency;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->actingAs(L::titulaire($this->org));
    $this->bail = L::bail($this->org);
    $this->locataire = L::partie($this->org);
    R::lier($this->org, $this->bail, $this->locataire, ['valid_from' => $this->bail->starts_on->toDateString()]);
    $this->facturer = function (string $echeance): string {
        $id = $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id, 'due_on' => $echeance]))->assertCreated()->json('data.id');
        $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated();

        return $id;
    };
    $this->lire = fn (callable $appel) => L::dans($this->org, fn () => $appel(app(InvoiceLedger::class)));
});

it('unpaidByLease : les factures de bail échues et non soldées, avec le reste dû du grand livre', function (): void {
    $echue = ($this->facturer)('2026-11-20');
    $soldee = ($this->facturer)('2026-11-20');
    ($this->facturer)('2026-12-31');
    C::regler($this, $this->org, L::dans($this->org, fn () => Invoice::query()->findOrFail($soldee)), 12000)->assertCreated();
    C::regler($this, $this->org, L::dans($this->org, fn () => Invoice::query()->findOrFail($echue)), 2000)->assertCreated();
    $apres = CarbonImmutable::parse('2026-11-25');

    $impayes = ($this->lire)(fn (InvoiceLedger $l) => $l->unpaidByLease($apres, $this->bail->id));

    expect($impayes)->toHaveCount(1)
        ->and($impayes[0]->invoiceId)->toBe($echue)
        ->and($impayes[0]->leaseId)->toBe($this->bail->id)
        ->and($impayes[0]->partyId)->toBe($this->locataire->id)
        ->and($impayes[0]->dueOn)->toBe('2026-11-20')
        ->and($impayes[0]->total->getAmount())->toBe('12000')
        ->and($impayes[0]->outstanding->getAmount())->toBe('10000')
        ->and(($this->lire)(fn (InvoiceLedger $l) => $l->unpaidByLease(CarbonImmutable::parse('2026-11-20'), $this->bail->id)))->toBe([]);
});

it('unpaidByLease ignore les factures sans bail, les brouillons et les avoirs, et pagine', function (): void {
    $partie = C::destinataire($this->org);
    C::emettre($this, $this->org, $partie);
    $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id, 'due_on' => '2026-11-20']))->assertCreated();
    $a = ($this->facturer)('2026-11-19');
    $b = ($this->facturer)('2026-11-19');
    $apres = CarbonImmutable::parse('2026-11-25');

    $page = ($this->lire)(fn (InvoiceLedger $l) => $l->unpaidByLease($apres, $this->bail->id, null, 1));
    $suite = ($this->lire)(fn (InvoiceLedger $l) => $l->unpaidByLease($apres, $this->bail->id, $page[0]->invoiceId, 5));

    expect($page)->toHaveCount(1)->and($suite)->toHaveCount(1)->and([$page[0]->invoiceId, $suite[0]->invoiceId])->toEqualCanonicalizing([$a, $b]);
});

it('find : la pièce émise de l\'organisation courante, 404 sinon', function (): void {
    $id = ($this->facturer)('2026-11-20');
    $brouillon = $this->postJson(C::url($this->org), C::brouillon($this->locataire))->assertCreated()->json('data.id');
    $autre = C::organisation(nom: 'Autre agence');

    $document = ($this->lire)(fn (InvoiceLedger $l) => $l->find($id));

    expect($document->number)->toBe('FA-2026-0001')->and($document->leaseId)->toBe($this->bail->id)->and($document->storedFileId)->not->toBe('');
    expect(fn () => ($this->lire)(fn (InvoiceLedger $l) => $l->find($brouillon)))->toThrow(ApiProblem::class);
    expect(fn () => L::dans($autre, fn () => app(InvoiceLedger::class)->find($id)))->toThrow(ApiProblem::class);
});

it('la facture d\'un bail figure au solde du bail dans le grand livre', function (): void {
    ($this->facturer)('2026-11-20');

    expect((int) L::dans($this->org, fn () => app(LedgerReader::class)->dueByLease($this->bail->id, new Currency('EUR'))->getAmount()))->toBe(12000);
});
