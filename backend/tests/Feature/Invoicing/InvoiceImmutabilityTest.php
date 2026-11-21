<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->facture = C::emettre($this, $this->org, $this->partie);
    $this->reglement = C::regler($this, $this->org, $this->facture, 1000)->assertCreated()->json('data.id');
});

it('refuse en base toute modification d\'une colonne figée d\'une pièce émise', function (string $colonne, mixed $valeur): void {
    expect(fn () => DB::table('invoices')->where('id', $this->facture->id)->update([$colonne => $valeur]))->toThrow(QueryException::class);
})->with([
    'total' => ['total_net', 1],
    'numéro' => ['number', 'FA-2026-9999'],
    'destinataire' => ['recipient_party_id', '01a1ee6d-5c77-7005-8193-397eefd7352d'],
    'instantané' => ['snapshot', '{}'],
    'empreinte' => ['fingerprint', 'x'],
    'devise' => ['currency', 'USD'],
    'échéance' => ['due_on', '2030-01-01'],
]);

it('refuse tout retour au brouillon et toute suppression d\'une pièce émise', function (): void {
    expect(fn () => DB::table('invoices')->where('id', $this->facture->id)->update(['status' => 'draft']))->toThrow(QueryException::class);
    expect(fn () => DB::table('invoices')->where('id', $this->facture->id)->delete())->toThrow(QueryException::class);
});

it('laisse évoluer le statut de règlement, l\'envoi, le signalement de retard et la version', function (): void {
    DB::table('invoices')->where('id', $this->facture->id)->update(['status' => 'paid', 'sent_at' => now(), 'overdue_flagged_at' => now(), 'lock_version' => 9]);

    expect(DB::table('invoices')->where('id', $this->facture->id)->value('status'))->toBe('paid');
});

it('refuse de toucher aux lignes et aux taxes d\'une pièce émise', function (): void {
    expect(fn () => DB::table('invoice_lines')->where('invoice_id', $this->facture->id)->update(['net_amount' => 1]))->toThrow(QueryException::class);
    expect(fn () => DB::table('invoice_lines')->where('invoice_id', $this->facture->id)->delete())->toThrow(QueryException::class);
    expect(fn () => DB::table('invoice_taxes')->where('invoice_id', $this->facture->id)->update(['tax_amount' => 1]))->toThrow(QueryException::class);
    expect(fn () => DB::table('invoice_taxes')->where('invoice_id', $this->facture->id)->delete())->toThrow(QueryException::class);
    $ligne = (array) DB::table('invoice_lines')->where('invoice_id', $this->facture->id)->first();
    expect(fn () => DB::table('invoice_lines')->insert([...$ligne, 'id' => (string) Str::uuid7(), 'position' => 9]))->toThrow(QueryException::class);
});

it('un règlement ne se supprime ni ne se modifie ; seule l\'annulation est permise, une fois', function (): void {
    expect(fn () => DB::table('invoice_payments')->where('id', $this->reglement)->delete())->toThrow(QueryException::class);
    expect(fn () => DB::table('invoice_payments')->where('id', $this->reglement)->update(['amount' => 1]))->toThrow(QueryException::class);

    $this->postJson("/api/v1/org/{$this->org->id}/invoice-payments/{$this->reglement}/cancel")->assertOk();

    expect(fn () => DB::table('invoice_payments')->where('id', $this->reglement)->update(['cancelled_at' => null, 'cancellation_entry_id' => null]))->toThrow(QueryException::class);
});

it('un brouillon reste modifiable et supprimable en ses lignes, sans trigger', function (): void {
    $id = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    DB::table('invoice_lines')->where('invoice_id', $id)->update(['net_amount' => 5]);
    expect(DB::table('invoice_lines')->where('invoice_id', $id)->value('net_amount'))->toBe(5);
});
