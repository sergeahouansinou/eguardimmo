<?php

declare(strict_types=1);

use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Enums\VatRegime;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('le serveur recalcule tout : taux, totaux, devise, numéro, statut et date envoyés sont ignorés', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['tax_rate_pcm' => 1, 'net_amount' => 1])], [
        'total_gross' => 1, 'total_tax' => 0, 'currency' => 'USD', 'number' => 'FA-9999-0001', 'status' => 'paid', 'issued_on' => '2020-01-01', 'organization_id' => (string) Str::uuid7(),
    ]))->assertCreated()->assertJsonPath('data.currency', 'EUR')->assertJsonPath('data.status', 'draft')->assertJsonPath('data.number', null)->json('data.id');

    $reponse = $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated();

    $reponse->assertJsonPath('data.number', 'FA-2026-0001')->assertJsonPath('data.issued_on', '2026-11-18')->assertJsonPath('data.total_gross.amount', 12000)
        ->assertJsonPath('data.total_tax.amount', 2000)->assertJsonPath('data.lines.0.tax_rate_pcm', 20000);
    expect(L::dans($this->org, fn () => Invoice::query()->find($id)->organization_id))->toBe($this->org->id);
});

it('refuse un taux inconnu ou ambigu', function (): void {
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['tax_category' => 'Z'])]))->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_unknown');
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['tax_rate_key' => null])]))->assertUnprocessable()->assertJsonPath('code', 'invoice_tax_rate_unknown');
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['tax_rate_key' => 'taux_invente'])]))->assertUnprocessable();
});

it('la taxe est calculée une fois par taux sur la somme des bases (demi supérieur)', function (): void {
    $lignes = array_fill(0, 3, C::ligne(333, ['item_term_id' => C::nature('service'), 'tax_rate_key' => 'fr_vat_reduced']));
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie, $lignes))->assertCreated()->assertJsonPath('data.total_net.amount', 999)->assertJsonPath('data.total_tax.amount', 55)->json('data.id');

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()->assertJsonPath('data.total_gross.amount', 1054)->assertJsonCount(1, 'data.taxes');
});

it('plusieurs taux donnent une ligne de taxe par taux', function (): void {
    $lignes = [C::ligne(10000), C::ligne(5000, ['item_term_id' => C::nature('service'), 'tax_rate_key' => 'fr_vat_intermediate']), C::ligne(2000, ['tax_rate_key' => 'fr_vat_normal'])];
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie, $lignes))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()
        ->assertJsonPath('data.total_net.amount', 17000)->assertJsonPath('data.total_tax.amount', 2900)->assertJsonCount(2, 'data.taxes');
});

it('la quantité fractionnaire est arrondie au demi supérieur', function (): void {
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(1001, ['quantity_milli' => 1500])]))->assertCreated()->assertJsonPath('data.lines.0.net_amount', 1502);
});

it('franchise en base : catégorie O imposée, aucune TVA, mention légale', function (): void {
    C::identite($this->org, VatRegime::Franchise);
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()->assertJsonPath('data.total_tax.amount', 0)->assertJsonPath('data.total_gross.amount', 10000)->assertJsonPath('data.lines.0.tax_category', 'O');

    $mentions = L::dans($this->org, fn () => Invoice::query()->find($id)->snapshot['mentions']);
    expect(implode(' ', $mentions))->toContain('art. 293 B du CGI');
});

it('autoliquidation : TVA nulle et mention', function (): void {
    $assujettie = C::entreprise($this->org, 'FR23732829320');
    $id = $this->postJson(C::url($this->org), C::brouillon($assujettie, [C::ligne(10000, ['tax_category' => 'AE', 'tax_rate_key' => 'fr_vat_reverse_charge'])]))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated()->assertJsonPath('data.total_tax.amount', 0)->assertJsonPath('data.taxes.0.category', 'AE');
    expect(implode(' ', L::dans($this->org, fn () => Invoice::query()->find($id)->snapshot['mentions'])))->toContain('utoliquidation');
});

it('une nature de recouvrement est interdite à un destinataire qui n\'est pas le mandant', function (): void {
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['item_term_id' => C::nature('recovery_cost')])]))
        ->assertUnprocessable()->assertJsonPath('code', 'invoice_item_forbidden_for_tenant');
});

it('refuse des lignes invalides', function (): void {
    $this->postJson(C::url($this->org), C::brouillon($this->partie, []))->assertUnprocessable();
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['quantity_milli' => 0])]))->assertUnprocessable();
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(-1)]))->assertUnprocessable();
    $this->postJson(C::url($this->org), C::brouillon($this->partie, [C::ligne(10000, ['item_term_id' => (string) Str::uuid7()])]))->assertNotFound();
});

it('un brouillon se modifie sous contrôle de version, puis se rejoue', function (): void {
    $brouillon = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated();
    $id = $brouillon->json('data.id');
    $version = $brouillon->json('data.lock_version');
    $corps = ['recipient_party_id' => $this->partie->id, 'lock_version' => $version, 'lines' => [C::ligne(20000)]];

    $this->patchJson(C::url($this->org, "/{$id}"), $corps)->assertOk()->assertJsonPath('data.total_net.amount', 20000)->assertJsonPath('data.lock_version', $version + 1);
    $this->patchJson(C::url($this->org, "/{$id}"), $corps)->assertStatus(409)->assertJsonPath('code', 'invoice_stale_version');
    $this->patchJson(C::url($this->org, "/{$id}"), [...$corps, 'lock_version' => $version + 1, 'idempotency_key' => 'interdite-en-patch'])->assertUnprocessable();
});

it('une pièce émise ne se modifie plus et ne s\'abandonne plus', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $this->patchJson(C::url($this->org, "/{$facture->id}"), ['recipient_party_id' => $this->partie->id, 'lock_version' => $facture->lock_version, 'lines' => [C::ligne()]])->assertStatus(409)->assertJsonPath('code', 'invoice_not_draft');
    $this->postJson(C::url($this->org, "/{$facture->id}/discard"))->assertStatus(409)->assertJsonPath('code', 'invoice_not_draft');
});

it('refuse d\'émettre sans identité légale complète de l\'émetteur', function (): void {
    $sans = C::organisation(identite: false, nom: 'Agence sans identité');
    C::basculer($this, $sans);
    $partie = C::destinataire($sans);
    $id = $this->postJson(C::url($sans), C::brouillon($partie))->assertCreated()->json('data.id');

    $this->postJson(C::url($sans, "/{$id}/issue"))->assertUnprocessable()->assertJsonPath('code', 'invoice_issuer_incomplete');
    expect(DB::table('invoices')->where('id', $id)->value('number'))->toBeNull();
});

it('garde de facture électronique : un destinataire assujetti est refusé à partir de la date configurée', function (): void {
    $entreprise = C::entreprise($this->org);
    $id = $this->postJson(C::url($this->org), C::brouillon($entreprise))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated();

    $autre = $this->postJson(C::url($this->org), C::brouillon($entreprise))->assertCreated()->json('data.id');
    config(['invoicing.e_invoicing.FR.from' => '2026-11-18']);
    $this->postJson(C::url($this->org, "/{$autre}/issue"))->assertUnprocessable()->assertJsonPath('code', 'invoice_einvoicing_required');
    expect(DB::table('invoices')->where('id', $autre)->value('number'))->toBeNull();
});
