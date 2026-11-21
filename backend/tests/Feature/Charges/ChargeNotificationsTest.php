<?php

declare(strict_types=1);

use App\Modules\Charges\Events\ChargeRegularizationDue;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Mail\NotificationMail;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Tenant\TenantRentContext as R;

beforeEach(function (): void {
    C::preparer($this);
    Mail::fake();
});

it('prévient le locataire de l\'émission du décompte, sans montant ni pièce, une seule fois', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $moi = User::factory()->create();
    R::rattacher($scene['org'], $scene['tenantParty'], $moi);
    $autre = User::factory()->create();

    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $n = N::premiere($moi, Type::TenantChargeStatementIssued);

    expect($n->title)->toBe('Décompte de charges disponible')->and($n->body)->toContain($scene['lease']->reference)->not->toContain('8000')->not->toContain('3000')
        ->and($n->link)->toBe("/regularisation-charges/{$decompte['id']}")->and($n->in_app)->toBeTrue()
        ->and(N::nombre($autre))->toBe(0);
    Mail::assertSent(NotificationMail::class, fn (NotificationMail $m): bool => $m->titre === 'Décompte de charges disponible');

    E::emettre($this, $scene, $exercice, 'emission-rejouee')->assertStatus(409);
    expect(N::nombre($moi, Type::TenantChargeStatementIssued))->toBe(1);
});

it('alerte l\'équipe qui gère les baux d\'un bail sans décompte, une seule alerte par exercice', function (): void {
    $scene = C::agence();
    $equipe = N::equipe($scene['org']);
    $evenement = new ChargeRegularizationDue($scene['lease']->id, $scene['org']->id, 2025);

    event($evenement);
    event($evenement);
    event(new ChargeRegularizationDue($scene['lease']->id, $scene['org']->id, 2026));

    expect(N::nombre($equipe['owner'], Type::ChargesRegularizationDue))->toBe(2)->and(N::nombre($equipe['manager'], Type::ChargesRegularizationDue))->toBe(2)
        ->and(N::nombre($equipe['accountant'], Type::ChargesRegularizationDue))->toBe(0);
    $n = N::premiere($equipe['owner'], Type::ChargesRegularizationDue);
    expect($n->body)->toContain($scene['lease']->reference)->and($n->link)->toBe("/baux/{$scene['lease']->id}");
});
