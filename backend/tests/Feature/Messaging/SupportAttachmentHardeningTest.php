<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Messaging\MessagingContext as M;

const PDF_SUPPORT = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF";

beforeEach(function (): void {
    Notification::fake();
    Storage::fake('local');
    $this->demandeur = User::factory()->create();
    $this->ouvrir = fn (array $corps = []) => $this->actingAs($this->demandeur)->post('/api/v1/support/tickets', [
        'space' => 'marketplace', 'category' => 'documents', 'subject' => 'Pièce', 'body' => 'Voir pièce jointe', ...$corps,
    ], ['Accept' => 'application/json']);
    $this->repondre = function (string $ticket, array $corps) {
        auth()->forgetGuards();

        return $this->actingAs($this->demandeur)->post("/api/v1/support/tickets/{$ticket}/messages", $corps, ['Accept' => 'application/json']);
    };
});

it('aligne le nom affiché sur le type détecté : un PDF nommé .html ressort .pdf', function (): void {
    ($this->ouvrir)(['attachments' => [UploadedFile::fake()->createWithContent('facture.html', PDF_SUPPORT)]])
        ->assertCreated()->assertJsonPath('data.messages.0.attachments.0.name', 'facture.pdf');

    expect(SupportAttachment::query()->firstOrFail()->original_name)->toBe('facture.pdf');
});

it('purge les caractères de direction du texte du nom affiché', function (): void {
    ($this->ouvrir)(['attachments' => [UploadedFile::fake()->createWithContent("recu\u{202E}fdp.pdf", PDF_SUPPORT)]])->assertCreated();

    expect(SupportAttachment::query()->firstOrFail()->original_name)->toBe('recufdp.pdf');
});

it('garde .jpeg pour une image JPEG et ajoute l\'extension manquante', function (): void {
    $image = imagecreatetruecolor(10, 10);
    ob_start();
    imagejpeg($image);
    $jpeg = (string) ob_get_clean();

    ($this->ouvrir)(['attachments' => [UploadedFile::fake()->createWithContent('photo.jpeg', $jpeg), UploadedFile::fake()->createWithContent('scan', PDF_SUPPORT)]])->assertCreated();

    expect(SupportAttachment::query()->pluck('original_name')->sort()->values()->all())->toBe(['photo.jpeg', 'scan.pdf']);
});

it('refuse une pièce polyglotte (PDF suivi de code PHP) sans rien stocker', function (): void {
    ($this->ouvrir)(['attachments' => [UploadedFile::fake()->createWithContent('piege.pdf', PDF_SUPPORT."\n<?php system(\$_GET['c']); ?>")]])
        ->assertUnprocessable();

    expect(SupportTicket::query()->count())->toBe(0)->and(SupportAttachment::query()->count())->toBe(0)->and(Storage::disk('local')->allFiles())->toBe([]);
});

it('rejoue une réponse avec pièce jointe dont le nom a été normalisé, sans conflit de clé', function (): void {
    $ticket = ($this->ouvrir)()->assertCreated()->json('data.id');
    $cle = M::cle();
    $corps = fn (): array => ['body' => 'Voici', 'client_id' => $cle, 'attachments' => [UploadedFile::fake()->createWithContent('facture.html', PDF_SUPPORT)]];

    $premier = ($this->repondre)($ticket, $corps())->assertOk()->json('data.id');
    $second = ($this->repondre)($ticket, $corps())->assertOk()->json('data.id');

    expect($second)->toBe($premier)->and(SupportAttachment::query()->count())->toBe(1);
});

it('limite les réponses de ticket à 200 par jour et par compte', function (): void {
    $ticket = ($this->ouvrir)()->assertCreated()->json('data.id');

    foreach (range(1, 200) as $i) {
        if ($i % 25 === 0) {
            $this->travel(61)->seconds();
        }
        ($this->repondre)($ticket, ['body' => "Précision {$i}"])->assertOk();
    }

    $this->travel(61)->seconds();
    ($this->repondre)($ticket, ['body' => 'Une de trop'])->assertStatus(429);
});
