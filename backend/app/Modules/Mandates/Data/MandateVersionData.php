<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

final readonly class MandateVersionData
{
    public function __construct(public int $lockVersion) {}
}
