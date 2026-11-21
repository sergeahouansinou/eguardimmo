<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\NewDeviceLoginNotification;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Notifications\MemberInvitationNotification;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

const PIEGE_LIEN = "[Confirmez](https://attaquant.example/login) <a href=\"https://attaquant.example/html\">ici</a> ![px](https://attaquant.example/p.png) <https://attaquant.example/auto> *gras* `code`\r\nBcc: pirate@attaquant.example";

function rendreMail(object $notification): string
{
    return (string) $notification->toMail(new stdClass)->render();
}

function assertAucunLienPiege(string $html): void
{
    expect($html)
        ->not->toMatch('/<a\s[^>]*attaquant\.example/i')
        ->not->toMatch('/<img\s[^>]*attaquant\.example/i')
        ->not->toContain('<strong>gras')
        ->not->toContain('<code>code')
        ->toContain('Confirmez');
}

it('neutralise le nom d\'organisation, le nom de l\'invitant et le message dans l\'invitation de membre', function (): void {
    $notification = new MemberInvitationNotification(PIEGE_LIEN, PIEGE_LIEN, 'https://auth.exemple.test/invitation/'.str_repeat('a', 48), PIEGE_LIEN);
    $html = rendreMail($notification);

    assertAucunLienPiege($html);
    expect($html)->toContain('href="https://auth.exemple.test/invitation/'.str_repeat('a', 48).'"')
        ->and($notification->toMail(new stdClass)->subject)->not->toContain("\n")->not->toContain("\r");
});

it('garde lisibles des noms et un message ordinaires dans l\'invitation de membre', function (): void {
    $html = rendreMail(new MemberInvitationNotification('Agence du Port - Cotonou', 'Awa Diallo', 'https://auth.exemple.test/invitation/'.str_repeat('b', 48), 'Bienvenue dans l\'équipe !'));

    expect($html)->toContain('Agence du Port - Cotonou')->toContain('Awa Diallo')->toContain('Bienvenue dans l\'équipe !')
        ->toContain('href="https://auth.exemple.test/invitation/'.str_repeat('b', 48).'"');
});

it('envoie un message piégé neutralisé quand un administrateur invite un membre', function (): void {
    Notification::fake();
    $titulaire = User::factory()->create();
    activerDeuxFacteurs($titulaire);
    $org = app(CreateOrganization::class)->handle($titulaire, new NewOrganizationData(OrganizationKind::Agency, 'Agence du Port', 'FR'), 'Awa', 'Diallo');

    $this->actingAs($titulaire)->postJson("/api/v1/org/{$org->id}/members", [
        'email' => 'invite@example.com', 'first_name' => 'Fatou', 'last_name' => 'Ndiaye', 'role' => 'manager', 'scope' => ['type' => 'all'], 'message' => PIEGE_LIEN,
    ])->assertCreated();

    Notification::assertSentTo(new AnonymousNotifiable, MemberInvitationNotification::class, function (MemberInvitationNotification $n): bool {
        assertAucunLienPiege(rendreMail($n));

        return true;
    });
});

it('neutralise le nom d\'appareil dans l\'alerte de nouvelle connexion', function (): void {
    $notification = new NewDeviceLoginNotification(PIEGE_LIEN);

    assertAucunLienPiege(rendreMail($notification));
});

it('garde lisible un nom d\'appareil ordinaire dans l\'alerte de nouvelle connexion', function (): void {
    expect(rendreMail(new NewDeviceLoginNotification('iPhone de Awa (iOS 19)')))->toContain('iPhone de Awa')->toContain('Sécuriser mon compte');
});
