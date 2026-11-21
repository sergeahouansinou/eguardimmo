<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->equipe = N::equipe($this->org);
});

it('refuse chaque route sans jeton', function (): void {
    $id = Str::uuid7()->toString();

    $this->getJson(N::URL)->assertUnauthorized();
    $this->getJson(N::URL.'/unread-count')->assertUnauthorized();
    $this->postJson(N::URL."/{$id}/read")->assertUnauthorized();
    $this->postJson(N::URL.'/read-all')->assertUnauthorized();
    $this->getJson(N::URL.'/preferences')->assertUnauthorized();
    $this->putJson(N::URL.'/preferences', [])->assertUnauthorized();
    $this->postJson('/api/v1/me/push-tokens', [])->assertUnauthorized();
    $this->deleteJson("/api/v1/me/push-tokens/{$id}")->assertUnauthorized();
});

it('liste les notifications du compte avec la forme du menu de notifications, la plus récente d\'abord', function (): void {
    N::ligne($this->equipe['owner'], $this->org, Type::RentOverdue, ['title' => 'Loyer en retard', 'body' => 'Le bail BL-1 est en retard.']);
    $recente = N::ligne($this->equipe['owner'], $this->org, Type::RentPaymentRecorded, ['title' => 'Paiement enregistré', 'read_at' => now()]);
    N::ligne($this->equipe['manager'], $this->org, Type::RentOverdue);

    N::comme($this, $this->equipe['owner']);
    $reponse = $this->getJson(N::URL)->assertOk()->assertJsonCount(2, 'data');

    expect($reponse->json('data.0.id'))->toBe($recente->id)
        ->and($reponse->json('data.0'))->toMatchArray(['type' => 'rent.payment_recorded', 'tone' => 'success', 'title' => 'Paiement enregistré', 'unread' => false, 'href' => '/finances/impayes', 'organization_id' => $this->org->id])
        ->and($reponse->json('data.1'))->toMatchArray(['type' => 'rent.overdue', 'tone' => 'danger', 'detail' => 'Le bail BL-1 est en retard.', 'unread' => true]);

    $this->getJson(N::URL.'?unread=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'rent.overdue');
    $this->getJson(N::URL.'/unread-count')->assertOk()->assertJsonPath('data.unread', 1);
});

it('marque une notification lue, rejouable, puis toutes', function (): void {
    $a = N::ligne($this->equipe['owner'], $this->org, Type::RentOverdue);
    N::ligne($this->equipe['owner'], $this->org, Type::RentPaymentRecorded);
    N::ligne($this->equipe['owner'], $this->org, Type::RentPaymentCancelled);
    N::comme($this, $this->equipe['owner']);

    $this->postJson(N::URL."/{$a->id}/read")->assertOk()->assertJsonPath('data.unread', false);
    $this->postJson(N::URL."/{$a->id}/read")->assertOk();
    $this->getJson(N::URL.'/unread-count')->assertJsonPath('data.unread', 2);

    $this->postJson(N::URL.'/read-all')->assertOk()->assertJsonPath('data.updated', 2);
    $this->getJson(N::URL.'/unread-count')->assertJsonPath('data.unread', 0);
});

it('un compte ne lit ni ne marque jamais les notifications d\'un autre, et reçoit la même 404 qu\'un identifiant inconnu', function (): void {
    $autre = N::ligne($this->equipe['manager'], $this->org, Type::RentOverdue);
    N::comme($this, $this->equipe['owner']);

    $this->getJson(N::URL)->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(N::URL.'/unread-count')->assertJsonPath('data.unread', 0);
    $volee = $this->postJson(N::URL."/{$autre->id}/read")->assertNotFound()->assertJsonPath('code', 'notification_not_found');
    $inconnue = $this->postJson(N::URL.'/'.Str::uuid7()->toString().'/read')->assertNotFound();
    $this->postJson(N::URL.'/read-all')->assertOk()->assertJsonPath('data.updated', 0);

    expect($volee->json('detail'))->toBe($inconnue->json('detail'))
        ->and(Notification::query()->find($autre->id)?->read_at)->toBeNull();
});

it('pagine par curseur sans doublon ni trou', function (): void {
    $lignes = array_map(fn (int $i): Notification => N::ligne($this->equipe['owner'], $this->org, Type::RentOverdue, ['title' => "Notification {$i}"]), range(1, 5));
    N::comme($this, $this->equipe['owner']);

    $vues = [];
    $curseur = null;

    do {
        $page = $this->getJson(N::URL.'?per_page=2'.($curseur === null ? '' : '&cursor='.urlencode($curseur)))->assertOk();
        $vues = [...$vues, ...array_column($page->json('data'), 'id')];
        $curseur = $page->json('meta.next_cursor');
    } while ($curseur !== null);

    expect($vues)->toBe(array_reverse(array_map(fn (Notification $n): string => $n->id, $lignes)));
    $this->getJson(N::URL.'?cursor=pas-un-curseur')->assertUnprocessable();
    $this->getJson(N::URL.'?per_page=500')->assertUnprocessable();
});

it('un ex-membre ne voit plus rien de l\'organisation quittée, ni ne peut marquer ses anciennes notifications', function (): void {
    $ligne = N::ligne($this->equipe['manager'], $this->org, Type::RentOverdue);
    N::comme($this, $this->equipe['manager']);
    $this->getJson(N::URL)->assertJsonCount(1, 'data');

    N::retirer($this->org, $this->equipe['manager']);
    N::comme($this, $this->equipe['manager']);

    $this->getJson(N::URL)->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(N::URL.'/unread-count')->assertJsonPath('data.unread', 0);
    $this->postJson(N::URL."/{$ligne->id}/read")->assertNotFound();
    $this->postJson(N::URL.'/read-all')->assertJsonPath('data.updated', 0);
    expect(Notification::query()->find($ligne->id)?->read_at)->toBeNull();
});

it('un rôle rétrogradé ne voit plus les types qu\'il ne lit pas', function (): void {
    N::ligne($this->equipe['accountant'], $this->org, Type::LeaseSigned);
    N::ligne($this->equipe['accountant'], $this->org, Type::RentOverdue);
    N::comme($this, $this->equipe['accountant']);

    $this->getJson(N::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'rent.overdue');
});

it('le filtre par organisation restreint sans jamais élargir', function (): void {
    $autre = C::organisation(nom: 'Agence du Nord');
    $compte = $this->equipe['manager'];
    L::dans($autre, fn () => OrganizationMember::query()->create([
        'user_id' => $compte->id, 'email' => mb_strtolower($compte->email), 'first_name' => 'Marc', 'last_name' => 'Chevalier',
        'role' => MemberRole::Manager, 'status' => MemberStatus::Active, 'joined_at' => now(),
    ]));
    N::ligne($compte, $this->org, Type::RentOverdue);
    N::ligne($compte, $autre, Type::RentOverdue);
    $etrangere = C::organisation(nom: 'Agence tierce');
    N::ligne($compte, $etrangere, Type::RentOverdue);
    N::comme($this, $compte);

    $this->getJson(N::URL)->assertJsonCount(2, 'data');
    $this->getJson(N::URL."?organization={$autre->id}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.organization_id', $autre->id);
    $this->getJson(N::URL."?organization={$etrangere->id}")->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(N::URL.'?organization=pas-un-uuid')->assertUnprocessable();

    $this->postJson(N::URL.'/read-all', ['organization' => $autre->id])->assertJsonPath('data.updated', 1);
    $this->getJson(N::URL.'/unread-count?organization='.$this->org->id)->assertJsonPath('data.unread', 1);
});

it('un locataire ne voit que les notifications d\'un bail encore visible, période de grâce comprise', function (): void {
    ['user' => $locataire, 'lease' => $actif] = T::locataire($this->org);
    ['lease' => $ancien] = T::locataire($this->org, ['starts_on' => '2020-01-01', 'ends_on' => '2024-01-01'], [], $locataire);
    N::ligne($locataire, $this->org, Type::TenantNoticeIssued, ['lease_id' => $actif->id, 'link' => '/loyers']);
    N::ligne($locataire, $this->org, Type::TenantNoticeIssued, ['lease_id' => $ancien->id]);
    N::ligne($locataire, $this->org, Type::TenantNoticeIssued, ['lease_id' => Str::uuid7()->toString()]);
    N::comme($this, $locataire);

    $this->getJson(N::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.href', '/loyers');
});

it('refuse un jeton opérateur', function (): void {
    $operateur = User::factory()->create();
    $jeton = $operateur->createToken('console', ['operator'])->plainTextToken;

    $this->withToken($jeton)->getJson(N::URL)->assertStatus(403);
});
