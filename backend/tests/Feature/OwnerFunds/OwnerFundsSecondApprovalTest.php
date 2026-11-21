<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function changerRole(object $org, object $compte, MemberRole $role): void
{
    L::dans($org, fn () => OrganizationMember::query()->where('user_id', $compte->id)->update(['role' => $role]));
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
});

it('le lot fige à la validation l\'exigence de second approbateur et le nombre de membres habilités', function (): void {
    F::comptable($this->org);
    $ids = F::lotValide($this);

    $lot = L::dans($this->org, fn () => DB::table('payout_batches')->where('id', $ids['batch'])->first());

    expect((bool) $lot->second_approver_required)->toBeTrue()->and((int) $lot->approvers_count)->toBe(2);
});

it('un membre rétrogradé après la validation ne rouvre pas le mode solo : l\'exigence figée tient', function (): void {
    $comptable = F::comptable($this->org);
    $ids = F::lotValide($this);
    changerRole($this->org, $comptable, MemberRole::Manager);

    F::executer($this, $ids)->assertForbidden()->assertJsonPath('code', 'payout_second_approver_required');
});

it('un lot validé en solo ne s\'exécute plus en solo quand l\'équipe a grossi depuis la validation', function (): void {
    $ids = F::lotValide($this);
    F::comptable($this->org);

    F::executer($this, $ids)->assertForbidden()->assertJsonPath('code', 'payout_second_approver_required');
});

it('sans changement d\'équipe, le mode solo reste permis et journalisé', function (): void {
    $ids = F::lotValide($this);

    F::executer($this, $ids)->assertOk()->assertJsonPath('data.executed_solo', true);
});

it('un second membre distinct exécute, y compris après un changement d\'équipe', function (): void {
    $comptable = F::comptable($this->org);
    $ids = F::lotValide($this);
    changerRole($this->org, $comptable, MemberRole::Manager);
    $autre = F::comptable($this->org);
    $this->actingAs($autre);

    F::executer($this, $ids)->assertOk()->assertJsonPath('data.executed_solo', false);
});

it('la règle désactivée par la configuration fige un lot sans exigence', function (): void {
    config(['owner_funds.require_second_approver' => false]);
    F::comptable($this->org);
    $ids = F::lotValide($this);

    F::executer($this, $ids)->assertOk()->assertJsonPath('data.executed_solo', true);
});
