<?php

declare(strict_types=1);

use App\Modules\Invoicing\PublicApi\InvoiceLedger;
use App\Modules\Leases\Models\LeaseParty;
use Carbon\CarbonImmutable;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->actingAs(L::titulaire($this->org));
    $this->lot = L::lot($this->org);
    $this->bail = L::bail($this->org);
    R::occuper($this->org, $this->bail, $this->lot, ['valid_from' => $this->bail->starts_on->toDateString()]);
    $this->locataire = L::partie($this->org);
    R::lier($this->org, $this->bail, $this->locataire, ['valid_from' => $this->bail->starts_on->toDateString()]);
    $this->mandant = L::partie($this->org);
    $this->mandat = M::actif($this->org, $this->lot, $this->mandant);
});

it('refuse un bail dont le destinataire n\'est pas partie, sauf le mandant d\'un mandat qui couvre le lot du bail', function (): void {
    $etranger = C::destinataire($this->org);

    $this->postJson(C::url($this->org), C::brouillon($etranger, null, ['lease_id' => $this->bail->id]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_references_inconsistent');
    $this->postJson(C::url($this->org), C::brouillon($this->mandant, null, ['lease_id' => $this->bail->id]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_references_inconsistent');
    $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id]))->assertCreated();
    $this->postJson(C::url($this->org), C::brouillon($this->mandant, null, ['lease_id' => $this->bail->id, 'mandate_id' => $this->mandat->id]))->assertCreated();
});

it('refuse un mandat dont le destinataire n\'est pas le mandant sans bail, ou qui ne couvre aucun lot du bail', function (): void {
    $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['mandate_id' => $this->mandat->id]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_references_inconsistent');
    $this->postJson(C::url($this->org), C::brouillon($this->mandant, null, ['mandate_id' => $this->mandat->id]))->assertCreated();

    $autreMandat = M::actif($this->org, L::lot($this->org), $this->mandant);
    $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id, 'mandate_id' => $autreMandat->id]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_references_inconsistent');
});

it('l\'émission revérifie la cohérence des références d\'un brouillon', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id]))->assertCreated()->json('data.id');
    L::dans($this->org, fn () => LeaseParty::query()->where('lease_id', $this->bail->id)->where('party_id', $this->locataire->id)->delete());

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertUnprocessable()->assertJsonPath('code', 'invoice_references_inconsistent');
});

it('unpaidByLease ne remonte jamais une facture dont le débiteur n\'est pas locataire du bail (mandant facturé sur le bail)', function (): void {
    $locataire = $this->postJson(C::url($this->org), C::brouillon($this->locataire, null, ['lease_id' => $this->bail->id, 'due_on' => '2026-11-20']))->assertCreated()->json('data.id');
    $mandant = $this->postJson(C::url($this->org), C::brouillon($this->mandant, null, ['lease_id' => $this->bail->id, 'mandate_id' => $this->mandat->id, 'due_on' => '2026-11-20']))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$locataire}/issue"))->assertCreated();
    $this->postJson(C::url($this->org, "/{$mandant}/issue"))->assertCreated();

    $impayes = L::dans($this->org, fn () => app(InvoiceLedger::class)->unpaidByLease(CarbonImmutable::parse('2026-11-25'), $this->bail->id));

    expect(array_map(fn ($i) => $i->invoiceId, $impayes))->toBe([$locataire]);
});
