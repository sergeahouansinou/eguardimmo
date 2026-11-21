<?php

declare(strict_types=1);

use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    Storage::fake('local');
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    $this->travelTo(CarbonImmutable::parse('2026-11-19 10:00:00'));
    $this->org = T::organisation();
    $this->base = "/api/v1/org/{$this->org->id}/conversations";
    $this->auteur = L::titulaire($this->org);
    $this->collegue = L::membre($this->org, MemberRole::Manager);
    $this->fil = O::comme($this, $this->auteur)->postJson($this->base, ['recipient_id' => $this->collegue->id, 'subject' => 'Point', 'body' => 'Message 0'])->assertCreated()->json('data.id');
    $this->deja = 1;
});

function grossirFil(mixed $test, int $cible): void
{
    $lignes = [];

    for (; $test->deja < $cible; $test->deja++) {
        $lignes[] = [
            'id' => (string) Str::uuid7(), 'organization_id' => $test->org->id, 'conversation_id' => $test->fil, 'author_user_id' => $test->auteur->id,
            'body' => 'Message '.$test->deja, 'sent_at' => CarbonImmutable::parse('2026-11-19 10:00:00')->addSeconds($test->deja)->format('Y-m-d H:i:s.u'),
            'created_at' => now(), 'updated_at' => now(), 'author_side' => 'staff',
        ];
    }

    DB::table('conversation_messages')->insert($lignes);
    DB::table('conversations')->where('id', $test->fil)->update(['last_message_at' => CarbonImmutable::parse('2026-11-19 10:00:00')->addSeconds($cible)->format('Y-m-d H:i:s.u')]);
}

function compterRequetesFilInterne(callable $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $total = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $total;
}

it('lit et répond dans un fil interne avec un nombre de requêtes constant quel que soit son historique', function (): void {
    $lecture = [];
    $reponse = [];

    foreach ([1, 10, 100] as $cible) {
        grossirFil($this, $cible);
        $lecture[$cible] = compterRequetesFilInterne(fn () => O::comme($this, $this->auteur)->getJson("{$this->base}/{$this->fil}")->assertOk());
        $reponse[$cible] = compterRequetesFilInterne(fn () => O::comme($this, $this->auteur)->postJson("{$this->base}/{$this->fil}/messages", ['body' => "Réponse {$cible}"])->assertOk());
    }

    expect($lecture[10])->toBe($lecture[1])->and($lecture[100])->toBe($lecture[1])
        ->and($reponse[10])->toBe($reponse[1])->and($reponse[100])->toBe($reponse[1]);
});

it('charge le fil interne et ses droits une seule fois en répondant', function (): void {
    $requetes = [];
    DB::listen(function ($requete) use (&$requetes): void {
        $requetes[] = $requete->sql;
    });

    O::comme($this, $this->auteur)->postJson("{$this->base}/{$this->fil}/messages", ['body' => 'Une réponse'])->assertOk();

    $chargementsDuFil = array_filter($requetes, fn (string $sql): bool => str_contains($sql, 'from "conversation_participants"') && str_contains($sql, '"conversation_participants"."user_id" = ?') && str_contains($sql, 'messages_count'));
    expect($chargementsDuFil)->toHaveCount(1);
});

it('borne le fil interne aux 200 derniers messages, dans l\'ordre, avec le vrai total', function (): void {
    grossirFil($this, 205);

    $reponse = O::comme($this, $this->auteur)->getJson("{$this->base}/{$this->fil}")->assertOk()->assertJsonCount(200, 'data.messages')->assertJsonPath('data.message_count', 205);

    expect($reponse->json('data.messages.0.body'))->toBe('Message 5')->and($reponse->json('data.messages.199.body'))->toBe('Message 204')
        ->and(ConversationMessage::query()->withoutGlobalScopes()->count())->toBe(205);
});
