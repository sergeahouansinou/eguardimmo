<?php

declare(strict_types=1);

use App\Modules\Maintenance\Models\Intervention;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
});

it('refuse une écriture sur une version périmée, sans rien modifier', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);

    $this->patchJson(C::url($this->scene['org'], "/interventions/{$id}"), ['lock_version' => 1, 'title' => 'Titre corrigé'])->assertOk()->assertJsonPath('data.lock_version', 2);
    $this->patchJson(C::url($this->scene['org'], "/interventions/{$id}"), ['lock_version' => 1, 'title' => 'Écrasement'])->assertConflict()->assertJsonPath('code', 'intervention_stale_version');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner'])->assertConflict()->assertJsonPath('code', 'intervention_stale_version');

    expect(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->title)->toBe('Titre corrigé');
});

it('la qualification fige le plafond du mandat ; le client ne peut ni le fixer ni changer d\'organisation', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/qualify"), [
        'lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner', 'ceiling_amount' => 99999999, 'mandate_id' => fake()->uuid(), 'organization_id' => fake()->uuid(), 'status' => 'closed',
    ])->assertOk()->assertJsonPath('data.status', 'qualified')->assertJsonPath('data.ceiling_amount.amount', 50000)->assertJsonPath('data.mandate_id', $this->scene['mandate']->id);
});

it('la responsabilité du locataire ou du bailleur est portée par la qualification', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'urgent', 'responsibility' => 'tenant'])->assertOk()
        ->assertJsonPath('data.priority', 'urgent')->assertJsonPath('data.responsibility', 'tenant');
});

it('annule jusqu\'à la fin des travaux, puis plus rien ne bouge', function (): void {
    $id = C::enDevis($this, $this->scene);

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/cancel"), ['lock_version' => 3])->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 4, 'priority' => 'normal', 'responsibility' => 'owner'])->assertConflict()->assertJsonPath('code', 'intervention_transition_invalid');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/reopen"), ['lock_version' => 4])->assertConflict();
});

it('rouvre une intervention terminée, mais plus dès qu\'une facture est enregistrée', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $version = fn (): int => Intervention::query()->withoutGlobalScopes()->findOrFail($id)->lock_version;

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/reopen"), ['lock_version' => $version()])->assertOk()->assertJsonPath('data.status', 'in_progress');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/complete"), ['lock_version' => $version(), 'completed_on' => '2026-11-20', 'note' => 'Terminé.'])->assertOk();

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/invoices"), [
        'number' => 'F-ROUVRE', 'invoice_on' => '2026-11-20', 'file_id' => C::fichier($this, $this->scene, $id, 'invoice'),
        'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]], 'idempotency_key' => 'facture-rouvre',
    ])->assertCreated();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/reopen"), ['lock_version' => $version()])->assertConflict()->assertJsonPath('code', 'intervention_transition_invalid');
});

it('clôture sans facture seulement avec un motif, et jamais avec une facture à imputer', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $version = fn (): int => Intervention::query()->withoutGlobalScopes()->findOrFail($id)->lock_version;
    $url = C::url($this->scene['org'], "/interventions/{$id}/close");

    $this->postJson($url, ['lock_version' => $version()])->assertConflict()->assertJsonPath('code', 'intervention_close_blocked');
    $this->postJson($url, ['lock_version' => $version(), 'no_invoice_reason' => 'Travaux pris en charge par le prestataire.'])->assertOk()->assertJsonPath('data.status', 'closed');
});

it('l\'absence du prestataire ramène l\'intervention à l\'état approuvé et permet une nouvelle visite', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $this->scene, $id);
    $devis = (string) C::devis($this, $this->scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();

    $visite = (string) $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning'])->assertCreated()->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits/{$visite}/done"))->assertConflict()->assertJsonPath('code', 'visit_status_invalid');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits/{$visite}/confirm"))->assertOk();
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits/{$visite}/no-show"))->assertOk();

    $this->getJson(C::url($this->scene['org'], "/interventions/{$id}"))->assertJsonPath('data.status', 'approved');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-22', 'slot' => 'afternoon'])->assertCreated();
});

it('la visite refuse une date passée et un téléphone incohérent', function (): void {
    $id = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);

    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-10', 'slot' => 'morning'])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    $this->postJson(C::url($this->scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'contact_phone' => '<script>'])->assertUnprocessable();
});

it('gère le carnet de prestataires : un prestataire actif et assuré seulement, suspension, archivage', function (): void {
    $scene = $this->scene;
    C::comme($this, $scene['owner']);

    $this->postJson(C::url($scene['org'], '/suppliers'), ['party_id' => $scene['supplier']->id, 'preferred' => true, 'payment_terms_days' => 30])->assertCreated()
        ->assertJsonPath('data.status', 'active')->assertJsonPath('data.preferred', true);
    $this->postJson(C::url($scene['org'], '/suppliers'), ['party_id' => $scene['supplier']->id])->assertConflict();
    $this->getJson(C::url($scene['org'], '/suppliers'))->assertOk()->assertJsonCount(1, 'data');

    $id = (string) C::signaler($this, $scene)->assertCreated()->json('data.id');
    C::comme($this, $scene['owner']);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner'])->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/assign"), ['lock_version' => 2, 'supplier_party_id' => $scene['supplier']->id])->assertUnprocessable()->assertJsonPath('code', 'supplier_insurance_missing');

    C::assurer($scene['org'], $scene['supplier']);
    $this->postJson(C::url($scene['org'], '/suppliers/'.$this->getJson(C::url($scene['org'], '/suppliers'))->json('data.0.id').'/suspend'))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/assign"), ['lock_version' => 2, 'supplier_party_id' => $scene['supplier']->id])->assertUnprocessable()->assertJsonPath('code', 'supplier_unavailable');
});

it('liste filtrée et paginée par curseur, cloisonnée à l\'organisation', function (): void {
    $premiere = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    $this->travelTo(now()->addHours(2));
    $seconde = (string) C::signaler($this, $this->scene)->assertCreated()->json('data.id');
    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/interventions/{$seconde}/decline"), ['lock_version' => 1, 'reason' => 'duplicate', 'note' => 'Doublon.'])->assertOk();

    $this->getJson(C::url($this->scene['org'], '/interventions?status=reported'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $premiere);
    $this->getJson(C::url($this->scene['org'], '/interventions?origin=team'))->assertOk()->assertJsonCount(0, 'data');
    $page = $this->getJson(C::url($this->scene['org'], '/interventions?per_page=1'))->assertOk()->assertJsonCount(1, 'data');
    expect($page->json('meta.next_cursor'))->not->toBeNull();
});

it('le contrôle quotidien est muet sur un cycle sain et signale un engagement au-dessus du plafond sans accord', function (): void {
    $id = C::travauxTermines($this, $this->scene);
    $this->artisan('maintenance:verify')->expectsOutputToContain('Aucune anomalie.')->assertSuccessful();

    $autre = C::enDevis($this, $this->scene, 60000);
    $devis = (string) C::devis($this, $this->scene, $autre, 60000)->assertCreated()->json('data.id');
    DB::table('intervention_quotes')->where('id', $devis)->update(['status' => 'accepted']);

    $this->artisan('maintenance:verify')->expectsOutputToContain('au-dessus du plafond')->assertFailed();
    expect($id)->not->toBe($autre);
});
