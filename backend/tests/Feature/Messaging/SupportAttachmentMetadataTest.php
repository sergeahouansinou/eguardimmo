<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

const MARQUEUR_GPS = 'GPS-48.8566N-2.3522E-MARQUEUR';

function imageSource(string $type): string
{
    $image = imagecreatetruecolor(30, 20);
    imagefill($image, 0, 0, (int) imagecolorallocate($image, 200, 30, 30));
    ob_start();
    $type === 'jpeg' ? imagejpeg($image) : imagepng($image);

    return (string) ob_get_clean();
}

function imageAvecMetadonnees(string $type): string
{
    $brut = imageSource($type);

    if ($type === 'jpeg') {
        $exif = "Exif\0\0".MARQUEUR_GPS;

        return substr($brut, 0, 2)."\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($brut, 2);
    }

    $texte = 'Comment'."\0".MARQUEUR_GPS;
    $chunk = pack('N', strlen($texte)).'tEXt'.$texte.pack('N', crc32('tEXt'.$texte));

    return substr($brut, 0, 33).$chunk.substr($brut, 33);
}

function ouvrirAvecPiece(mixed $test, UploadedFile $piece): TestResponse
{
    return $test->actingAs($test->demandeur)->post('/api/v1/support/tickets', [
        'space' => 'marketplace', 'category' => 'documents', 'subject' => 'Photo', 'body' => 'Voir pièce jointe', 'attachments' => [$piece],
    ], ['Accept' => 'application/json']);
}

beforeEach(function (): void {
    Notification::fake();
    Storage::fake('local');
    $this->demandeur = User::factory()->create();
});

it('réencode les images du support : plus de segment EXIF ni de position GPS, pixels conservés', function (string $type, string $nom, string $mime): void {
    $source = imageAvecMetadonnees($type);
    expect($source)->toContain(MARQUEUR_GPS);

    ouvrirAvecPiece($this, UploadedFile::fake()->createWithContent($nom, $source))->assertCreated()->assertJsonPath('data.messages.0.attachments.0.mime_type', $mime);

    $piece = SupportAttachment::query()->firstOrFail();
    $stocke = (string) Storage::disk('local')->get($piece->path);
    $taille = getimagesizefromstring($stocke);

    expect($stocke)->not->toContain(MARQUEUR_GPS)->not->toContain('Exif')->not->toContain('tEXt')
        ->and($stocke)->not->toBe($source)
        ->and($taille)->not->toBeFalse()
        ->and([$taille[0], $taille[1]])->toBe([30, 20]);
})->with([
    'jpeg' => ['jpeg', 'photo.jpg', 'image/jpeg'],
    'png' => ['png', 'photo.png', 'image/png'],
]);

it('stocke un PDF tel quel et le sert avec sa taille reçue', function (): void {
    $pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF";

    ouvrirAvecPiece($this, UploadedFile::fake()->createWithContent('quittance.pdf', $pdf))->assertCreated();

    $piece = SupportAttachment::query()->firstOrFail();
    expect(Storage::disk('local')->get($piece->path))->toBe($pdf)->and($piece->size_bytes)->toBe(strlen($pdf));
});

it('refuse une image illisible sans rien stocker', function (): void {
    $illisible = "\xFF\xD8\xFF\xE0".str_repeat("\x00", 64);

    ouvrirAvecPiece($this, UploadedFile::fake()->createWithContent('cassee.jpg', $illisible))->assertUnprocessable();

    expect(SupportAttachment::query()->count())->toBe(0)->and(Storage::disk('local')->allFiles())->toBe([]);
});
