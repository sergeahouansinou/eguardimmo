<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    $this->id = C::travauxTermines($this, $this->scene);
    $facture = $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices"), [
        'number' => 'F-VERROU', 'invoice_on' => '2026-11-20', 'file_id' => C::fichier($this, $this->scene, $this->id, 'invoice'),
        'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]], 'idempotency_key' => 'facture-verrou',
    ])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$facture}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-verrou'])->assertCreated();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/invoices/{$facture}/payments"), ['amount' => 1000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-verrou'])->assertCreated();
    $this->facture = $facture;
});

it('la chronologie est en ajout seul', function (): void {
    expect(fn () => DB::table('intervention_events')->update(['text' => 'réécrit']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_events')->delete())->toThrow(QueryException::class);
});

it('la seule réécriture permise de la chronologie est l\'effacement du texte d\'un commentaire du locataire', function (): void {
    $locataire = (string) Str::uuid7();
    $equipe = (string) Str::uuid7();
    $autre = (string) Str::uuid7();
    foreach ([[$locataire, 'tenant', 'comment'], [$equipe, 'team', 'comment'], [$autre, 'tenant', 'reported']] as [$uuid, $acteur, $kind]) {
        DB::table('intervention_events')->insert(['id' => $uuid, 'organization_id' => $this->scene['org']->id, 'intervention_id' => $this->id, 'kind' => $kind, 'actor_kind' => $acteur, 'text' => 'texte', 'created_at' => now()]);
    }

    expect(fn () => DB::table('intervention_events')->where('id', $locataire)->update(['text' => 'réécrit']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_events')->where('id', $locataire)->update(['text' => '[effacé]', 'visible_to_owner' => true]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_events')->where('id', $equipe)->update(['text' => '[effacé]']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_events')->where('id', $autre)->update(['text' => '[effacé]']))->toThrow(QueryException::class);

    expect(DB::table('intervention_events')->where('id', $locataire)->update(['text' => '[effacé]']))->toBe(1)
        ->and(DB::table('intervention_events')->where('id', $locataire)->value('text'))->toBe('[effacé]');
});

it('rien de ce qui a servi à engager ou à payer ne se supprime', function (): void {
    foreach (['interventions', 'intervention_quotes', 'supplier_invoices', 'supplier_invoice_taxes', 'invoice_allocations', 'supplier_payments'] as $table) {
        $leve = false;
        try {
            DB::table($table)->delete();
        } catch (QueryException) {
            $leve = true;
        }
        expect($leve)->toBeTrue($table);
    }
});

it('un devis soumis et ses lignes sont figés', function (): void {
    expect(fn () => DB::table('intervention_quotes')->update(['total_net' => 1, 'total_gross' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_quote_lines')->update(['unit_price' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('intervention_quote_lines')->delete())->toThrow(QueryException::class);
});

it('une facture reçue, ses taxes, ses imputations et ses règlements sont immuables ; seule l\'annulation passe', function (): void {
    expect(fn () => DB::table('supplier_invoices')->update(['total_net' => 1, 'total_tax' => 0, 'total_gross' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('supplier_invoice_taxes')->update(['tax_amount' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('invoice_allocations')->update(['share_amount' => 1, 'charged_amount' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('supplier_payments')->update(['amount' => 1]))->toThrow(QueryException::class);

    $this->postJson(C::url($this->scene['org'], '/supplier-payments/'.DB::table('supplier_payments')->value('id').'/cancel'))->assertOk();
    expect(fn () => DB::table('supplier_payments')->update(['cancelled_at' => null, 'cancellation_entry_id' => null]))->toThrow(QueryException::class);
});

it('l\'identité d\'une intervention ne se modifie pas', function (): void {
    expect(fn () => DB::table('interventions')->update(['reference' => 'AUTRE']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('interventions')->update(['organization_id' => fake()->uuid()]))->toThrow(QueryException::class);
});

it('un état terminal ne se rouvre pas', function (): void {
    $this->postJson(C::url($this->scene['org'], "/interventions/{$this->id}/close"), ['lock_version' => DB::table('interventions')->value('lock_version')])->assertOk();

    expect(fn () => DB::table('interventions')->update(['status' => 'reported']))->toThrow(QueryException::class);
});
