<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Properties\Models\Unit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    C::preparer($this);
    $this->scene = C::agence();
    C::comme($this, $this->scene['owner']);
});

it('une dépense sur les fonds du mandant débite son compte et sort de la banque de tiers', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 30000);

    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertCreated()->assertJsonPath('data.status', 'recorded')->assertJsonPath('data.mandant_party_id', $this->scene['mandant']->id);

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(30000 - 24000)
        ->and(C::net($this->scene['org'], AccountRole::OwnerPayable))->toBe(-6000)
        ->and(C::net($this->scene['org'], AccountRole::Expenses))->toBe(0);
});

it('refuse la dépense sur fonds de tiers quand le solde du mandant est insuffisant', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 10000);

    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertStatus(409)->assertJsonPath('code', 'owner_funds_insufficient');

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(10000);
});

it('refuse la dépense sur fonds de tiers quand les fonds des mandants ne sont pas activés', function (): void {
    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertStatus(409)->assertJsonPath('code', 'owner_funds_insufficient');
});

it('refuse la dépense sur fonds de tiers quand le compte de tiers ne couvre pas les dettes', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 30000, AccountRole::Bank);

    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertStatus(409)->assertJsonPath('code', 'trust_funds_gap');
});

it('l\'avance sur fonds propres laisse une créance sur le mandant sans contrôle de solde', function (): void {
    C::depense($this, $this->scene, ['settlement' => 'own_funds_advance'])->assertCreated();

    expect(C::net($this->scene['org'], AccountRole::Bank))->toBe(-24000)->and(C::net($this->scene['org'], AccountRole::OwnerPayable))->toBe(24000);
});

const GROSSE_DEPENSE = ['settlement' => 'trust', 'total_gross' => 150000, 'tax_amount' => 0, 'recoverable_amount' => 0, 'recoverable_rubric' => null];

it('au-delà du seuil, une autre personne habilitée valide la dépense sur fonds de tiers', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 400000);
    $comptable = C::membre($this->scene['org'], MemberRole::Accountant);

    C::avecPreuve($this, $this->scene['owner']);
    $id = C::depense($this, $this->scene, GROSSE_DEPENSE)->assertCreated()->assertJsonPath('data.status', 'pending_approval')->assertJsonPath('data.posted', false)->json('data.id');
    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(400000);

    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/approve"))->assertStatus(409)->assertJsonPath('code', 'charges_second_approver_required');

    C::avecPreuve($this, $comptable);
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/approve"))->assertOk()->assertJsonPath('data.status', 'recorded')->assertJsonPath('data.posted', true);
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/approve"))->assertStatus(409);

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(250000);
});

it('une équipe d\'une seule personne habilitée ne valide pas seule : la dépense attend un second membre', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 400000);

    C::avecPreuve($this, $this->scene['owner']);
    $id = C::depense($this, $this->scene, GROSSE_DEPENSE)->assertCreated()->assertJsonPath('data.status', 'pending_approval')->json('data.id');
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/approve"))->assertStatus(409)->assertJsonPath('code', 'charges_second_approver_required');

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(400000);

    $suspendu = C::membre($this->scene['org'], MemberRole::Accountant);
    L::dans($this->scene['org'], fn () => DB::table('organization_members')->where('user_id', $suspendu->id)->update(['status' => 'disabled']));
    C::avecPreuve($this, $this->scene['owner']);
    $autre = C::depense($this, $this->scene, GROSSE_DEPENSE)->assertCreated()->assertJsonPath('data.status', 'pending_approval')->json('data.id');

    expect(L::dans($this->scene['org'], fn () => DB::table('expenses')->where('id', $autre)->value('ledger_entry_id')))->toBeNull();
});

it('exige une preuve 2FA récente pour saisir au-delà du seuil et pour valider, jamais sous le seuil', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 400000);
    $comptable = C::membre($this->scene['org'], MemberRole::Accountant);

    C::depense($this, $this->scene, GROSSE_DEPENSE)->assertStatus(403)->assertJsonPath('code', 'reauthentication_required');
    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertCreated();

    C::avecPreuve($this, $this->scene['owner']);
    $id = C::depense($this, $this->scene, GROSSE_DEPENSE)->assertCreated()->json('data.id');

    $this->flushSession();
    C::comme($this, $comptable);
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/approve"))->assertStatus(403)->assertJsonPath('code', 'reauthentication_required');
    expect(L::dans($this->scene['org'], fn () => DB::table('expenses')->where('id', $id)->value('status')))->toBe('pending_approval');
});

it('annuler une dépense sur fonds de tiers exige un rôle de sortie d\'argent et rend les fonds au mandant', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 30000);
    $id = C::depense($this, $this->scene, ['settlement' => 'trust'])->assertCreated()->json('data.id');
    $gestionnaire = C::membre($this->scene['org'], MemberRole::Manager);

    C::comme($this, $gestionnaire);
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/cancel"), ['reason' => 'Erreur'])->assertForbidden()->assertJsonPath('code', 'charges_role_forbidden');

    C::comme($this, $this->scene['owner']);
    $this->postJson(C::url($this->scene['org'], "/expenses/{$id}/cancel"), ['reason' => 'Erreur'])->assertOk();

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(30000)->and(C::net($this->scene['org'], AccountRole::OwnerPayable))->toBe(-30000);
});

it('refuse les modes sur fonds de tiers au gestionnaire et à un compte sans double authentification', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 30000);

    C::comme($this, C::membre($this->scene['org'], MemberRole::Manager));
    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertForbidden()->assertJsonPath('code', 'charges_role_forbidden');

    C::comme($this, C::membre($this->scene['org'], MemberRole::Accountant, false));
    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertForbidden()->assertJsonPath('code', 'charges_two_factor_required');

    expect(C::net($this->scene['org'], AccountRole::TrustBank))->toBe(30000);
});

it('le gestionnaire enregistre une dépense payée par le mandant', function (): void {
    C::comme($this, C::membre($this->scene['org'], MemberRole::Manager, false));

    C::depense($this, $this->scene, ['settlement' => 'paid_by_owner', 'recoverable_amount' => 0, 'recoverable_rubric' => null])->assertCreated();
});

it('une agence ne règle pas une dépense par sa banque ou sa caisse', function (string $mode): void {
    C::depense($this, $this->scene, ['settlement' => $mode])->assertStatus(422)->assertJsonPath('code', 'expense_settlement_invalid');
})->with(['bank', 'cash']);

it('un bailleur autonome ne peut pas utiliser les modes d\'agence', function (string $mode): void {
    $autonome = C::autonome();
    C::comme($this, $autonome['owner']);

    C::depense($this, $autonome, ['settlement' => $mode, 'recoverable_amount' => 0, 'recoverable_rubric' => null])->assertForbidden()->assertJsonPath('code', 'charges_agency_only');
})->with(['trust', 'own_funds_advance', 'paid_by_owner']);

it('une dépense d\'immeuble dont les lots relèvent de plusieurs mandants est refusée', function (): void {
    $org = $this->scene['org'];
    $autre = L::dans($org, fn (): Unit => Unit::factory()->create(['property_id' => $this->scene['property'], 'unit_type_term_id' => L::terme('unit_type', 'apartment')->id]));
    M::actif($org, $autre, L::partie($org));

    C::depense($this, $this->scene, ['unit_id' => null, 'settlement' => 'own_funds_advance'])->assertStatus(422)->assertJsonPath('code', 'expense_split_required');
    C::depense($this, $this->scene, ['unit_id' => $this->scene['unit']->id, 'settlement' => 'own_funds_advance'])->assertCreated();
});

it('refuse un mode sur fonds de tiers pour un bien sans mandat', function (): void {
    $org = $this->scene['org'];
    $libre = L::lot($org);

    C::depense($this, ['property' => $libre->property_id, 'unit' => $libre, 'org' => $org, 'mandant' => $this->scene['mandant']], ['settlement' => 'own_funds_advance'])->assertStatus(422)->assertJsonPath('code', 'expense_settlement_invalid');
});

it('un refus après l\'écriture de la pièce ne laisse ni fichier ni ligne de stockage', function (): void {
    C::activerFonds($this->scene['org']);
    C::financer($this->scene['org'], $this->scene['mandant'], 10000);

    C::depense($this, $this->scene, ['settlement' => 'trust'])->assertStatus(409)->assertJsonPath('code', 'owner_funds_insufficient');

    expect(Storage::disk('documents')->allFiles($this->scene['org']->id))->toBe([])
        ->and(L::dans($this->scene['org'], fn () => DB::table('stored_files')->count()))->toBe(0);
});
