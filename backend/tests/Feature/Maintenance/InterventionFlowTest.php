<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Maintenance\Models\Intervention;
use Tests\Feature\Maintenance\MaintenanceContext as C;

beforeEach(function (): void {
    C::preparer($this);
});

it('mène une demande de locataire jusqu\'à la clôture, écritures comptables comprises', function (): void {
    $scene = C::agence();
    $id = C::travauxTermines($this, $scene);

    $facture = C::fichier($this, $scene, $id, 'invoice');
    $enregistree = $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices"), [
        'number' => 'F-2026-001',
        'invoice_on' => '2026-11-20',
        'file_id' => $facture,
        'declared_gross' => 24000,
        'taxes' => [['tax_rate_key' => 'fr_vat_normal', 'base' => 20000, 'tax' => 4000]],
        'idempotency_key' => 'facture-001',
    ])->assertCreated()->assertJsonPath('data.status', 'recorded')->assertJsonPath('data.total_gross.amount', 24000);
    $factureId = $enregistree->json('data.id');

    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(24000)
        ->and(Intervention::query()->withoutGlobalScopes()->findOrFail($id)->status->value)->toBe('invoiced');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$factureId}/allocations"), ['target' => 'owner', 'share_amount' => 24000, 'idempotency_key' => 'imputation-1'])
        ->assertCreated();
    $this->getJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$factureId}"))->assertOk()->assertJsonPath('data.status', 'allocated');
    expect(C::solde($scene['org'], AccountRole::WorksPending))->toBe(0);

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/invoices/{$factureId}/payments"), ['amount' => 24000, 'method' => 'transfer', 'paid_on' => '2026-11-21', 'idempotency_key' => 'reglement-1'])->assertCreated();

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/close"), ['lock_version' => Intervention::query()->withoutGlobalScopes()->findOrFail($id)->lock_version])
        ->assertOk()->assertJsonPath('data.status', 'closed');
});

it('un bailleur autonome décide seul : engagement sans mandat ni accord', function (): void {
    $scene = C::autonome();
    C::comme($this, $scene['owner']);

    $id = $this->postJson(C::url($scene['org'], '/interventions'), [
        'unit_id' => $scene['unit']->id,
        'nature_term_id' => C::nature('electrical'),
        'title' => 'Disjoncteur',
        'description' => 'Le disjoncteur saute.',
    ], ['Idempotency-Key' => 'creation-autonome-1'])->assertCreated()->assertJsonPath('data.origin', 'team')->json('data.id');

    $this->postJson(C::url($scene['org'], "/interventions/{$id}/qualify"), ['lock_version' => 1, 'priority' => 'normal', 'responsibility' => 'owner'])->assertOk()
        ->assertJsonPath('data.mandate_id', null)->assertJsonPath('data.ceiling_amount', null);
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/engage"), ['lock_version' => 2])->assertOk()
        ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.approval_basis', 'self_managed');
});

it('la liste des interventions porte les visites planifiées sous forme réduite, sans contact, et n\'en emprunte aucune à une autre organisation', function (): void {
    $scene = C::agence();
    $id = (string) C::signaler($this, $scene)->assertCreated()->json('data.id');
    C::enDevisPour($this, $scene, $id);
    $devis = (string) C::devis($this, $scene, $id, 10000)->assertCreated()->json('data.id');
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/submit"))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/quotes/{$devis}/accept"))->assertOk();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-25', 'slot' => 'afternoon', 'contact_name' => 'Plomberie Dupont'])->assertCreated();
    $this->postJson(C::url($scene['org'], "/interventions/{$id}/visits"), ['scheduled_on' => '2026-11-20', 'slot' => 'morning', 'contact_phone' => '0600000000'])->assertCreated();

    $liste = $this->getJson(C::url($scene['org'], '/interventions'))->assertOk();

    $liste->assertJsonCount(2, 'data.0.visits')
        ->assertJsonPath('data.0.visits.0.scheduled_on', '2026-11-20')->assertJsonPath('data.0.visits.0.slot', 'morning')->assertJsonPath('data.0.visits.1.scheduled_on', '2026-11-25');
    expect(array_keys($liste->json('data.0.visits.0')))->toBe(['id', 'scheduled_on', 'slot', 'status']);

    $autre = C::agence();
    C::comme($this, $autre['owner']);
    $this->getJson(C::url($autre['org'], '/interventions'))->assertOk()->assertJsonCount(0, 'data');
});
